using HamHub.Domain.Entities;
using HamHub.Domain.Enums;
using HamHub.Api.Services.Awards;
using Xunit;

namespace HamHub.Api.Tests;

public class AwardEngineTests
{
    [Fact]
    public void QsoEntryStoresAwardDimensionFields()
    {
        var qso = new QsoEntry
        {
            CqZone = 14,
            ItuZone = 18,
            County = "Aarhus",
            MyState = "DK",
            MyCounty = "Aarhus",
            PotaRefs = "DK-0001,DK-0002",
            SotaRefs = "OZ/OZ-001",
            AwardRefs = "SPECIAL-2026"
        };

        Assert.Equal(14, qso.CqZone);
        Assert.Equal(18, qso.ItuZone);
        Assert.Equal("Aarhus", qso.County);
        Assert.Equal("DK", qso.MyState);
        Assert.Equal("Aarhus", qso.MyCounty);
        Assert.Equal("DK-0001,DK-0002", qso.PotaRefs);
        Assert.Equal("OZ/OZ-001", qso.SotaRefs);
        Assert.Equal("SPECIAL-2026", qso.AwardRefs);
    }

    [Fact]
    public void CalculateCountsDxccWorkedConfirmedMissingAndUnconfirmed()
    {
        var engine = new AwardEngine();
        var qsos = new[]
        {
            Qso("OZ1AAA", dxcc: 3, country: "Afghanistan", confirmed: true),
            Qso("OZ1BBB", dxcc: 5, country: "Aland Islands", confirmed: false)
        };

        var response = engine.Calculate(qsos, new AwardQuery());
        var dxcc = Assert.Single(response.Awards, award => award.Id == "dxcc");

        Assert.Equal("active", dxcc.Status);
        Assert.Equal(2, dxcc.WorkedCount);
        Assert.Equal(1, dxcc.ConfirmedCount);
        Assert.Equal(100, dxcc.NextThreshold);
        Assert.Contains(dxcc.Entities, entity => entity.Key == "3" && entity.Status == "confirmed");
        Assert.Contains(dxcc.Entities, entity => entity.Key == "5" && entity.Status == "worked");
        Assert.Contains(dxcc.UnconfirmedEntities, entity => entity.Key == "5");
        Assert.True(dxcc.MissingCount > 0);
    }

    [Fact]
    public void CalculateSupportsContinentPrefixGridAndBandFilters()
    {
        var engine = new AwardEngine();
        var qsos = new[]
        {
            Qso("K1ABC", dxcc: 291, country: "United States", continent: "NA", locator: "FN42", band: Band.M20),
            Qso("JA1XYZ", dxcc: 339, country: "Japan", continent: "AS", locator: "PM95", band: Band.M40),
        };

        var response = engine.Calculate(qsos, new AwardQuery(Band: Band.M20));
        var wac = Assert.Single(response.Awards, award => award.Id == "wac");
        var wpx = Assert.Single(response.Awards, award => award.Id == "wpx");
        var grid = Assert.Single(response.Awards, award => award.Id == "grid");

        Assert.Equal(1, wac.WorkedCount);
        Assert.Contains(wac.Entities, entity => entity.Key == "NA");
        Assert.DoesNotContain(wac.Entities, entity => entity.Key == "AS");
        Assert.Contains(wpx.Entities, entity => entity.Key == "K1");
        Assert.Contains(grid.Entities, entity => entity.Key == "FN42");
    }

    [Fact]
    public void CalculateMarksFutureAwardsAsMissingDataOrComingNext()
    {
        var engine = new AwardEngine();
        var response = engine.Calculate(Array.Empty<QsoEntry>(), new AwardQuery());

        Assert.Contains(response.Awards, award => award.Id == "waz" && award.Status == "missing-data");
        Assert.Contains(response.Awards, award => award.Id == "pota" && award.Status == "coming-next");
    }

    private static QsoEntry Qso(
        string callsign,
        int dxcc,
        string country,
        string continent = "EU",
        string? locator = null,
        Band band = Band.M20,
        Mode mode = Mode.FT8,
        bool confirmed = false)
    {
        return new QsoEntry
        {
            UserId = "user-1",
            OwnCallsign = "OZ1ME",
            WorkedCallsign = callsign,
            DateUtc = new DateTime(2026, 6, 17, 10, 0, 0, DateTimeKind.Utc),
            Band = band,
            Mode = mode,
            Dxcc = dxcc,
            Country = country,
            Continent = continent,
            Locator = locator,
            LotwConfirmedAt = confirmed ? new DateTime(2026, 6, 17, 11, 0, 0, DateTimeKind.Utc) : null
        };
    }
}
