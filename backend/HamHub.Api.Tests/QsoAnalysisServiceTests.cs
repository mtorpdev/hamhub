using HamHub.Api.Services;
using HamHub.Api.Services.Awards;
using HamHub.Domain.Entities;
using HamHub.Domain.Enums;
using HamHub.Infrastructure.Persistence;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HamHub.Api.Tests;

public class QsoAnalysisServiceTests
{
    [Fact]
    public async Task AnalysisMarksConfirmedQsoAndBuildsStory()
    {
        await using var context = CreateContext();
        var user = User("user-1", "OZ1ME");
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

        var service = CreateService(context);

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

    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    private static QsoAnalysisService CreateService(ApplicationDbContext context) =>
        new(context, new AwardEngine());

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
}
