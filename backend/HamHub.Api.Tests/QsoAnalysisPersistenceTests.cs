using HamHub.Domain.Entities;
using HamHub.Domain.Enums;
using HamHub.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HamHub.Api.Tests;

public class QsoAnalysisPersistenceTests
{
    [Fact]
    public async Task QsoAnalysisCanBeStoredAndLoadedByQsoId()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        await using var db = new ApplicationDbContext(options);
        var user = new ApplicationUser
        {
            Id = "user-1",
            Email = "test@example.com",
            UserName = "test@example.com",
            Callsign = "OZ4MT"
        };
        var qso = new QsoEntry
        {
            Id = 1,
            UserId = user.Id,
            User = user,
            DateUtc = new DateTime(2026, 6, 21, 10, 0, 0, DateTimeKind.Utc),
            OwnCallsign = "OZ4MT",
            WorkedCallsign = "E74K",
            Band = Band.M20,
            Mode = Mode.FT8
        };

        db.Users.Add(user);
        db.QsoEntries.Add(qso);
        db.QsoAnalyses.Add(new QsoAnalysis
        {
            QsoId = qso.Id,
            UserId = user.Id,
            GeneratedAtUtc = DateTime.UtcNow,
            AnalysisVersion = 1,
            InputHash = "hash-1",
            OverallScore = 80,
            ConfirmationScore = 100,
            DataQualityScore = 70,
            AwardImpactScore = 60,
            PropagationScore = 50,
            DuplicateRiskScore = 0,
            HighlightsJson = "[]",
            FlagsJson = "[]",
            MissingDataJson = "[]",
            AwardImpactJson = "{}",
            QslJson = "{}",
            PropagationJson = "{}",
            SunJson = "{}",
            WeatherJson = "{}",
            DuplicateRiskJson = "{}",
            StoryText = "This QSO is confirmed."
        });
        await db.SaveChangesAsync();

        var stored = await db.QsoAnalyses.SingleAsync(a => a.QsoId == qso.Id);

        Assert.Equal("user-1", stored.UserId);
        Assert.Equal(80, stored.OverallScore);
        Assert.Equal("This QSO is confirmed.", stored.StoryText);
    }
}
