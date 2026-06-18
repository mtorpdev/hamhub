using HamHub.Api.Services;
using HamHub.Domain.Entities;
using HamHub.Domain.Enums;
using HamHub.Infrastructure.Services;
using Xunit;

namespace HamHub.Api.Tests;

public class LotwSyncServiceTests
{
    [Fact]
    public void ApplyConfirmationFillsMissingAwardFieldsWithoutOverwritingExistingData()
    {
        var qso = new QsoEntry
        {
            WorkedCallsign = "OZ1ABC",
            DateUtc = new DateTime(2026, 6, 16, 12, 30, 0, DateTimeKind.Utc),
            Band = Band.M20,
            Mode = Mode.FT8,
            Country = "Local Denmark",
            Dxcc = 221
        };

        var lotw = new LotwQslRecord(
            Call: "OZ1ABC",
            TimeOn: qso.DateUtc,
            Band: "20M",
            Mode: "FT8",
            QslDate: new DateTime(2026, 6, 17, 0, 0, 0, DateTimeKind.Utc),
            ReceivedAt: new DateTime(2026, 6, 17, 8, 10, 11, DateTimeKind.Utc),
            Gridsquare: "JO55WM",
            Country: "Denmark",
            Dxcc: 999,
            Continent: "EU",
            State: "SJ",
            CqZone: 14,
            ItuZone: 18,
            Iota: "EU-029");

        LotwSyncService.ApplyConfirmation(qso, lotw, new DateTime(2026, 6, 17, 9, 0, 0, DateTimeKind.Utc));

        Assert.Equal("Local Denmark", qso.Country);
        Assert.Equal(221, qso.Dxcc);
        Assert.Equal("EU", qso.Continent);
        Assert.Equal("SJ", qso.State);
        Assert.Equal(14, qso.CqZone);
        Assert.Equal(18, qso.ItuZone);
        Assert.Equal("EU-029", qso.Iota);
        Assert.Equal("JO55WM", qso.Locator);
        Assert.NotNull(qso.LotwConfirmedAt);
    }

    [Fact]
    public void MarkNotFoundUpdatesUncheckedQsoWithoutClearingConfirmation()
    {
        var uncheckedQso = new QsoEntry();
        var confirmedQso = new QsoEntry
        {
            LotwConfirmedAt = new DateTime(2026, 6, 17, 8, 10, 11, DateTimeKind.Utc),
            LotwLastResult = "LoTW bekræftet"
        };
        var now = new DateTime(2026, 6, 17, 9, 0, 0, DateTimeKind.Utc);

        Assert.True(LotwSyncService.MarkNotFound(uncheckedQso, now));
        Assert.False(LotwSyncService.MarkNotFound(confirmedQso, now));

        Assert.Equal("LoTW status opdateret: ikke fundet", uncheckedQso.LotwLastResult);
        Assert.Equal(now, uncheckedQso.UpdatedAt);
        Assert.Equal(new DateTime(2026, 6, 17, 8, 10, 11, DateTimeKind.Utc), confirmedQso.LotwConfirmedAt);
        Assert.Equal("LoTW bekræftet", confirmedQso.LotwLastResult);
    }

    [Fact]
    public void ShouldMarkNotFoundOnlyForFullReport()
    {
        Assert.True(LotwSyncService.ShouldMarkNotFound(previousLastSyncedAt: null));
        Assert.False(LotwSyncService.ShouldMarkNotFound(new DateTime(2026, 6, 18, 3, 28, 16, DateTimeKind.Utc)));
    }

    [Fact]
    public void IsLotwMatchAllowsKnownLocalTimeOffset()
    {
        var qso = new QsoEntry
        {
            UserId = "user-1",
            OwnCallsign = "OZ4MT",
            WorkedCallsign = "DL1ABC",
            DateUtc = new DateTime(2026, 6, 17, 10, 0, 0, DateTimeKind.Utc),
            Band = Band.M20,
            Mode = Mode.FT8
        };
        var lotw = new LotwQslRecord(
            Call: "DL1ABC",
            TimeOn: new DateTime(2026, 6, 17, 12, 0, 0, DateTimeKind.Utc),
            Band: "20M",
            Mode: "FT8",
            QslDate: null,
            ReceivedAt: null,
            Gridsquare: null,
            Country: null,
            Dxcc: null,
            Continent: null,
            State: null,
            CqZone: null,
            ItuZone: null,
            Iota: null);

        Assert.True(LotwSyncService.IsLotwMatch(qso, "user-1", lotw, Band.M20, Mode.FT8));
    }
}
