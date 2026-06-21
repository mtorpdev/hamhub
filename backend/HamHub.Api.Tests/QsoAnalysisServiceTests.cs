using HamHub.Api.Services;
using HamHub.Api.Services.Awards;
using HamHub.Domain.Entities;
using HamHub.Domain.Enums;
using HamHub.Infrastructure.Persistence;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using System.Net;
using System.Net.Http;
using System.Text;
using Xunit;

namespace HamHub.Api.Tests;

public class QsoAnalysisServiceTests
{
    [Fact]
    public async Task AnalysisMarksConfirmedQsoAndBuildsStory()
    {
        await using var context = CreateContext();
        var provider = DataProtectionProvider.Create(Path.Combine(Path.GetTempPath(), $"hamhub-analysis-{Guid.NewGuid():N}"));
        var user = User("user-1", "OZ1ME");
        user.LotwUsername = "oz1me";
        user.LotwPassword = provider.CreateProtector("LotwPassword").Protect("secret");
        var qso = Qso(user, "DL1ABC");
        qso.Mode = Mode.FT8;
        qso.LotwConfirmedAt = new DateTime(2026, 6, 21, 10, 5, 0, DateTimeKind.Utc);
        qso.LotwQslDate = new DateTime(2026, 6, 21, 10, 5, 0, DateTimeKind.Utc);
        qso.Dxcc = 230;
        qso.Country = "Fed. Rep. of Germany";
        qso.Continent = "EU";
        qso.CqZone = 14;
        qso.ItuZone = 28;
        qso.Locator = "JO62QM";
        qso.MyGridsquare = "JO65DQ";
        context.Users.Add(user);
        context.QsoEntries.Add(qso);
        await context.SaveChangesAsync();

        var service = CreateService(context, dataProtectionProvider: provider);

        var analysis = await service.GetOrCreateAsync(qso.Id, user.Id, false, CancellationToken.None);

        Assert.Equal(100, analysis.Scores.Confirmation);
        Assert.Contains(analysis.Qsl, item => item.Provider == "LoTW" && item.Status == "confirmed");
        Assert.Contains("LoTW", analysis.StoryText, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("FT8", analysis.StoryText, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task AnalysisWarnsWhenWorkedLocatorIsMissing()
    {
        await using var context = CreateContext();
        var user = User("user-1", "OZ1ME");
        var qso = Qso(user, "K1ABC");
        qso.MyGridsquare = "JO65DQ";
        qso.Locator = null;
        context.Users.Add(user);
        context.QsoEntries.Add(qso);
        await context.SaveChangesAsync();

        var service = CreateService(context);

        var analysis = await service.GetOrCreateAsync(qso.Id, user.Id, false, CancellationToken.None);

        Assert.Contains(analysis.DataQuality, issue => issue.Field == "locator" && issue.Severity == "warning");
        Assert.True(analysis.Scores.Propagation < 100);
    }

    [Fact]
    public async Task AnalysisDetectsDuplicateRiskWithinUtcWindow()
    {
        await using var context = CreateContext();
        var user = User("user-1", "OZ1ME");
        var first = Qso(user, "K1ABC");
        var duplicate = Qso(user, "K1ABC");
        duplicate.DateUtc = first.DateUtc.AddSeconds(45);
        context.Users.Add(user);
        context.QsoEntries.AddRange(first, duplicate);
        await context.SaveChangesAsync();

        var service = CreateService(context);

        var analysis = await service.GetOrCreateAsync(first.Id, user.Id, false, CancellationToken.None);

        Assert.True(analysis.Scores.DuplicateRisk > 0);
        Assert.Equal(1, analysis.DuplicateRisk.CandidateCount);
    }

    [Fact]
    public async Task AnalysisUsesCachedSnapshotWhenInputHashMatches()
    {
        await using var context = CreateContext();
        var user = User("user-1", "OZ1ME");
        var qso = Qso(user, "JA1XYZ");
        context.Users.Add(user);
        context.QsoEntries.Add(qso);
        await context.SaveChangesAsync();

        var service = CreateService(context);
        var first = await service.GetOrCreateAsync(qso.Id, user.Id, false, CancellationToken.None);
        var storedCountAfterFirst = await context.QsoAnalyses.CountAsync();

        var second = await service.GetOrCreateAsync(qso.Id, user.Id, false, CancellationToken.None);

        Assert.Equal(first.GeneratedAtUtc, second.GeneratedAtUtc);
        Assert.Equal(storedCountAfterFirst, await context.QsoAnalyses.CountAsync());
        Assert.Equal(1, storedCountAfterFirst);
    }

    [Fact]
    public async Task AnalysisRegeneratesWhenNearbyDuplicateCandidateChanges()
    {
        await using var context = CreateContext();
        var user = User("user-1", "OZ1ME");
        var qso = Qso(user, "JA1XYZ");
        context.Users.Add(user);
        context.QsoEntries.Add(qso);
        await context.SaveChangesAsync();

        var service = CreateService(context);
        var first = await service.GetOrCreateAsync(qso.Id, user.Id, false, CancellationToken.None);
        var firstHash = await context.QsoAnalyses.Where(item => item.QsoId == qso.Id).Select(item => item.InputHash).SingleAsync();

        var duplicate = Qso(user, qso.WorkedCallsign);
        duplicate.DateUtc = qso.DateUtc.AddSeconds(45);
        context.QsoEntries.Add(duplicate);
        await context.SaveChangesAsync();

        var second = await service.GetOrCreateAsync(qso.Id, user.Id, false, CancellationToken.None);
        var secondHash = await context.QsoAnalyses.Where(item => item.QsoId == qso.Id).Select(item => item.InputHash).SingleAsync();

        Assert.Equal(0, first.DuplicateRisk.CandidateCount);
        Assert.Equal(1, second.DuplicateRisk.CandidateCount);
        Assert.NotEqual(firstHash, secondHash);
    }

    [Fact]
    public async Task AnalysisRegeneratesWhenNearbyDuplicateCandidateDiffersOnlyByCallsignFormatting()
    {
        await using var context = CreateContext();
        var user = User("user-1", "OZ1ME");
        var qso = Qso(user, "JA1XYZ");
        context.Users.Add(user);
        context.QsoEntries.Add(qso);
        await context.SaveChangesAsync();

        var service = CreateService(context);
        var first = await service.GetOrCreateAsync(qso.Id, user.Id, false, CancellationToken.None);
        var firstHash = await context.QsoAnalyses.Where(item => item.QsoId == qso.Id).Select(item => item.InputHash).SingleAsync();

        var duplicate = Qso(user, "  ja1xyz  ");
        duplicate.DateUtc = qso.DateUtc.AddSeconds(45);
        context.QsoEntries.Add(duplicate);
        await context.SaveChangesAsync();

        var second = await service.GetOrCreateAsync(qso.Id, user.Id, false, CancellationToken.None);
        var secondHash = await context.QsoAnalyses.Where(item => item.QsoId == qso.Id).Select(item => item.InputHash).SingleAsync();

        Assert.Equal(0, first.DuplicateRisk.CandidateCount);
        Assert.Equal(1, second.DuplicateRisk.CandidateCount);
        Assert.True(second.Scores.DuplicateRisk > 0);
        Assert.NotEqual(firstHash, secondHash);
    }

    [Fact]
    public async Task AnalysisRegeneratesWhenQrzQslDateChanges()
    {
        await using var context = CreateContext();
        var user = User("user-1", "OZ1ME");
        var qso = Qso(user, "JA1XYZ");
        qso.QrzId = "123";
        context.Users.Add(user);
        context.QsoEntries.Add(qso);
        await context.SaveChangesAsync();

        var service = CreateService(context);
        var first = await service.GetOrCreateAsync(qso.Id, user.Id, false, CancellationToken.None);
        var firstHash = await context.QsoAnalyses.Where(item => item.QsoId == qso.Id).Select(item => item.InputHash).SingleAsync();

        qso.QrzQslDate = new DateTime(2026, 6, 21, 12, 34, 0, DateTimeKind.Utc);
        await context.SaveChangesAsync();

        var second = await service.GetOrCreateAsync(qso.Id, user.Id, false, CancellationToken.None);
        var secondHash = await context.QsoAnalyses.Where(item => item.QsoId == qso.Id).Select(item => item.InputHash).SingleAsync();

        Assert.Null(first.Qsl.Single(item => item.Provider == "QRZ").LastUpdatedAt);
        Assert.Equal(qso.QrzQslDate, second.Qsl.Single(item => item.Provider == "QRZ").LastUpdatedAt);
        Assert.NotEqual(firstHash, secondHash);
    }

    [Fact]
    public async Task AnalysisScoresQrzSyncedQsoAsExternalActivity()
    {
        await using var context = CreateContext();
        var provider = DataProtectionProvider.Create(Path.Combine(Path.GetTempPath(), $"hamhub-analysis-{Guid.NewGuid():N}"));
        var user = User("user-1", "OZ1ME");
        var qso = Qso(user, "JA1XYZ");
        qso.QrzId = "123";
        user.QrzApiKey = provider.CreateProtector("QrzApiKey").Protect("api-key");
        context.Users.Add(user);
        context.QsoEntries.Add(qso);
        await context.SaveChangesAsync();

        var service = CreateService(context, dataProtectionProvider: provider);

        var analysis = await service.GetOrCreateAsync(qso.Id, user.Id, false, CancellationToken.None);

        Assert.Contains(analysis.Qsl, item => item.Provider == "QRZ" && item.Status == "synced");
        Assert.Equal(60, analysis.Scores.Confirmation);
        Assert.Contains("external log activity", analysis.StoryText, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task AnalysisReturnsPersistedRowWhenConcurrentInsertWins()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite(connection)
            .Options;

        var qsoId = 0;
        await using (var setup = new ApplicationDbContext(options))
        {
            await setup.Database.EnsureCreatedAsync();
            var user = User("user-1", "OZ1ME");
            var qso = Qso(user, "JA1XYZ");
            setup.Users.Add(user);
            setup.QsoEntries.Add(qso);
            await setup.SaveChangesAsync();
            qsoId = qso.Id;
        }

        var injected = false;
        await using var context = new SaveInterceptionContext(
            options,
            async cancellationToken =>
            {
                if (injected)
                    return;

                injected = true;
                await using var competingContext = new ApplicationDbContext(options);
                var competingService = CreateService(competingContext);
                await competingService.GetOrCreateAsync(qsoId, "user-1", false, cancellationToken);
            });
        var service = CreateService(context);

        var analysis = await service.GetOrCreateAsync(qsoId, "user-1", false, CancellationToken.None);

        await using var verification = new ApplicationDbContext(options);
        Assert.Equal(1, await verification.QsoAnalyses.CountAsync());
        Assert.Equal(analysis.QsoId, (await verification.QsoAnalyses.SingleAsync()).QsoId);
    }

    [Fact]
    public async Task AnalysisEnrichesWeatherAndPropagationFromConditionServices()
    {
        await using var context = CreateContext();
        var user = User("user-1", "OZ1ME");
        var qso = Qso(user, "DL1ABC");
        qso.Locator = "JO62QM";
        qso.MyGridsquare = "JO65DQ";
        context.Users.Add(user);
        context.QsoEntries.Add(qso);
        await context.SaveChangesAsync();

        var service = CreateService(
            context,
            weatherHandler: new StubHttpMessageHandler(request =>
            {
                const string weatherJson = """
                {
                  "hourly": {
                    "time": ["2026-06-21T10:00"],
                    "temperature_2m": [18.5],
                    "relative_humidity_2m": [64],
                    "precipitation": [0.2],
                    "pressure_msl": [1012.4],
                    "cloud_cover": [55],
                    "wind_speed_10m": [14.0],
                    "wind_direction_10m": [220]
                  }
                }
                """;
                return Json(weatherJson);
            }),
            propagationHandler: new StubHttpMessageHandler(request => Json(request.RequestUri!.AbsolutePath switch
            {
                "/products/noaa-planetary-k-index.json" => """
                [
                  { "time_tag": "2026-06-21T09:00:00Z", "Kp": 3.67 },
                  { "time_tag": "2026-06-21T12:00:00Z", "Kp": 4.33 }
                ]
                """,
                "/products/noaa-scales.json" => """
                {
                  "0": {
                    "G": { "Scale": "1" },
                    "R": { "Scale": "0" },
                    "S": { "Scale": "0" }
                  }
                }
                """,
                "/products/solar-wind/plasma-7-day.json" => """
                [
                  ["time_tag", "density", "speed"],
                  ["2026-06-21T10:00:00Z", "6.2", "420.5"]
                ]
                """,
                "/products/solar-wind/mag-7-day.json" => """
                [
                  ["time_tag", "bx_gsm", "by_gsm", "bz_gsm", "lon_gsm", "lat_gsm", "bt"],
                  ["2026-06-21T10:00:00Z", "0", "0", "-2.4", "0", "0", "5.1"]
                ]
                """,
                "/json/45-day-forecast.json" => """
                {
                  "data": [
                    { "time": "2026-06-21T00:00:00Z", "metric": "ap", "value": 12 },
                    { "time": "2026-06-21T00:00:00Z", "metric": "f107", "value": 145 }
                  ]
                }
                """,
                "/products/solar-cycle-25-ssn-predicted-range.json" => """
                [
                  { "time-tag": "2026-06", "smoothed_ssn_min": 120, "smoothed_ssn_max": 140 },
                  { "time-tag": "2026-07", "smoothed_ssn_min": 121, "smoothed_ssn_max": 141 }
                ]
                """,
                "/json/goes/primary/xrays-1-day.json" => """
                [
                  { "energy": "0.1-0.8nm", "time_tag": "2026-06-21T10:00:00Z", "flux": 0.0000025 }
                ]
                """,
                _ => throw new InvalidOperationException($"Unexpected NOAA path {request.RequestUri!.AbsolutePath}")
            })),
            mufHandler: new StubHttpMessageHandler(_ => Json("""
            [
              {
                "station": { "name": "Chilton", "latitude": 51.5, "longitude": -1.3 },
                "fof2": 6.4,
                "mufd": 18.2,
                "cs": 87,
                "source": "GIRO",
                "time": "2026-06-21T10:00:00Z"
              }
            ]
            """)));

        var analysis = await service.GetOrCreateAsync(qso.Id, user.Id, false, CancellationToken.None);

        Assert.NotNull(analysis.Weather.Own);
        Assert.NotNull(analysis.Weather.Worked);
        Assert.Equal("Open-Meteo Historical Weather API", analysis.Weather.Source);
        Assert.Equal("NOAA SWPC", analysis.Propagation.Source);
        Assert.Equal(3.67, analysis.Propagation.KpIndex);
        Assert.Equal("G1", analysis.Propagation.GeomagneticScale);
        Assert.Equal("KC2G MUF/foF2 nowcast", analysis.Propagation.MufFof2.Source);
        Assert.NotNull(analysis.Propagation.MufFof2.OwnNearestStation);
        Assert.NotEmpty(analysis.Propagation.MufFof2.BandRecommendations);
    }

    [Fact]
    public async Task AnalysisMarksQslProvidersNotConfiguredWhenCredentialsMissing()
    {
        await using var context = CreateContext();
        var user = User("user-1", "OZ1ME");
        var qso = Qso(user, "JA1XYZ");
        context.Users.Add(user);
        context.QsoEntries.Add(qso);
        await context.SaveChangesAsync();

        var service = CreateService(context);

        var analysis = await service.GetOrCreateAsync(qso.Id, user.Id, false, CancellationToken.None);

        Assert.All(analysis.Qsl, item => Assert.Equal("not-configured", item.Status));
    }

    [Fact]
    public async Task AnalysisRegeneratesWhenCredentialReadabilityChangesAndShowsCredentialError()
    {
        await using var context = CreateContext();
        var user = User("user-1", "OZ1ME");
        var qso = Qso(user, "JA1XYZ");
        context.Users.Add(user);
        context.QsoEntries.Add(qso);
        await context.SaveChangesAsync();

        var provider = DataProtectionProvider.Create(Path.Combine(Path.GetTempPath(), $"hamhub-analysis-{Guid.NewGuid():N}"));
        var readableService = CreateService(context, dataProtectionProvider: provider);
        var first = await readableService.GetOrCreateAsync(qso.Id, user.Id, false, CancellationToken.None);
        var firstHash = await context.QsoAnalyses.Where(item => item.QsoId == qso.Id).Select(item => item.InputHash).SingleAsync();

        user.QrzApiKey = "unreadable";
        user.EqslUsername = "eqsl-user";
        user.EqslPassword = "unreadable";
        user.LotwUsername = "lotw-user";
        user.LotwPassword = "unreadable";
        await context.SaveChangesAsync();

        var unreadableProvider = DataProtectionProvider.Create(Path.Combine(Path.GetTempPath(), $"hamhub-analysis-{Guid.NewGuid():N}"));
        var unreadableService = CreateService(context, dataProtectionProvider: unreadableProvider);

        var second = await unreadableService.GetOrCreateAsync(qso.Id, user.Id, false, CancellationToken.None);
        var secondHash = await context.QsoAnalyses.Where(item => item.QsoId == qso.Id).Select(item => item.InputHash).SingleAsync();

        Assert.All(second.Qsl, item => Assert.Equal("credential-error", item.Status));
        Assert.NotEqual(firstHash, secondHash);
        Assert.NotEqual(first.GeneratedAtUtc, second.GeneratedAtUtc);
    }

    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    private static QsoAnalysisService CreateService(
        ApplicationDbContext context,
        HttpMessageHandler? weatherHandler = null,
        HttpMessageHandler? propagationHandler = null,
        HttpMessageHandler? mufHandler = null,
        IDataProtectionProvider? dataProtectionProvider = null) =>
        new(
            context,
            new AwardEngine(),
            new OpenMeteoWeatherService(new HttpClient(weatherHandler ?? new StubHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.BadGateway)))),
            new NoaaSwpcPropagationService(new HttpClient(propagationHandler ?? new StubHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.BadGateway)))),
            new Kc2gMufFof2Service(new HttpClient(mufHandler ?? new StubHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.BadGateway)))),
            dataProtectionProvider ?? DataProtectionProvider.Create(Path.Combine(Path.GetTempPath(), $"hamhub-analysis-{Guid.NewGuid():N}")));

    private static ApplicationUser User(string id, string callsign) => new()
    {
        Id = id,
        Email = $"{id}@example.com",
        UserName = $"{id}@example.com",
        Callsign = callsign
    };

    private static QsoEntry Qso(ApplicationUser user, string workedCallsign) => new()
    {
        UserId = user.Id,
        User = user,
        DateUtc = new DateTime(2026, 6, 21, 10, 0, 0, DateTimeKind.Utc),
        OwnCallsign = user.Callsign ?? "OZ1ME",
        WorkedCallsign = workedCallsign,
        Band = Band.M20,
        Frequency = 14.074,
        Mode = Mode.FT8,
        RstSent = "-10",
        RstReceived = "-08",
        Dxcc = 291,
        Country = "United States",
        Continent = "NA",
        CqZone = 5,
        ItuZone = 8,
        Locator = "FN42AB",
        MyGridsquare = "JO65DQ",
        TxPower = 50,
        CreatedAt = new DateTime(2026, 6, 21, 10, 0, 0, DateTimeKind.Utc),
        UpdatedAt = new DateTime(2026, 6, 21, 10, 0, 0, DateTimeKind.Utc)
    };

    private sealed class SaveInterceptionContext : ApplicationDbContext
    {
        private readonly Func<CancellationToken, Task> _beforeSaveAsync;
        private bool _callbackInvoked;

        public SaveInterceptionContext(
            DbContextOptions<ApplicationDbContext> options,
            Func<CancellationToken, Task> beforeSaveAsync)
            : base(options)
        {
            _beforeSaveAsync = beforeSaveAsync;
        }

        public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            var pendingAnalysisInsert = ChangeTracker.Entries<QsoAnalysis>()
                .Any(entry => entry.State == EntityState.Added);
            if (pendingAnalysisInsert && !_callbackInvoked)
            {
                _callbackInvoked = true;
                await _beforeSaveAsync(cancellationToken);
            }

            return await base.SaveChangesAsync(cancellationToken);
        }
    }

    private sealed class StubHttpMessageHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, HttpResponseMessage> _handler;

        public StubHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> handler)
        {
            _handler = handler;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(_handler(request));
    }

    private static HttpResponseMessage Json(string body) =>
        new(HttpStatusCode.OK)
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        };
}
