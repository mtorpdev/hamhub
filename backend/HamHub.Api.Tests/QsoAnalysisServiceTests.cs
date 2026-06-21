using HamHub.Api.Services;
using HamHub.Api.Services.Awards;
using HamHub.Domain.Entities;
using HamHub.Domain.Enums;
using HamHub.Infrastructure.Persistence;
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
}
