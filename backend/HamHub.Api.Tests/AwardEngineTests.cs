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

        Assert.Equal(2, response.QsoCount);
        Assert.Equal(1, response.ConfirmedQsoCount);
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
    public void CalculateReportsAwardDataQualityIssuesForQsos()
    {
        var engine = new AwardEngine();
        var qsos = new[]
        {
            new QsoEntry
            {
                Id = 101,
                UserId = "user-1",
                OwnCallsign = "OZ1ME",
                WorkedCallsign = "K1ABC",
                DateUtc = new DateTime(2026, 6, 17, 10, 0, 0, DateTimeKind.Utc),
                Band = Band.M20,
                Mode = Mode.FT8,
                Dxcc = 291,
                Country = "United States",
                Continent = "NA",
                State = "MA",
                County = "MA-Middlesex"
            },
            Qso("DL1ABC", dxcc: 230, country: "Fed. Rep. of Germany", continent: "EU", locator: "JO62", cqZone: 14, ituZone: 28)
        };

        var response = engine.Calculate(qsos, new AwardQuery());

        Assert.Equal(1, response.DataQuality.IssueQsoCount);
        Assert.Equal(3, response.DataQuality.Issues.Length);
        Assert.Contains(response.DataQuality.Issues, issue => issue.Field == "Locator" && issue.AwardIds.Contains("grid"));
        Assert.Contains(response.DataQuality.Issues, issue => issue.Field == "CqZone" && issue.AwardIds.Contains("waz"));
        Assert.Contains(response.DataQuality.Issues, issue => issue.Field == "ItuZone" && issue.AwardIds.Contains("itu-zones"));

        var qsoIssue = Assert.Single(response.DataQuality.Qsos);
        Assert.Equal(101, qsoIssue.QsoId);
        Assert.Equal("K1ABC", qsoIssue.WorkedCallsign);
        Assert.Contains(qsoIssue.MissingFields, field => field.Field == "Locator");
        Assert.Contains(qsoIssue.MissingFields, field => field.Field == "CqZone");
        Assert.Contains(qsoIssue.MissingFields, field => field.Field == "ItuZone");
    }

    [Fact]
    public void CalculateIncludesConfirmationSourcesForConfirmedEntities()
    {
        var engine = new AwardEngine();
        var qsos = new[]
        {
            new QsoEntry
            {
                UserId = "user-1",
                OwnCallsign = "OZ1ME",
                WorkedCallsign = "DL1ABC",
                DateUtc = new DateTime(2026, 6, 17, 10, 0, 0, DateTimeKind.Utc),
                Band = Band.M20,
                Mode = Mode.FT8,
                Dxcc = 230,
                Country = "Fed. Rep. of Germany",
                LotwConfirmedAt = new DateTime(2026, 6, 17, 11, 0, 0, DateTimeKind.Utc),
                QrzConfirmationStatus = "C"
            }
        };

        var response = engine.Calculate(qsos, new AwardQuery());
        var dxcc = Assert.Single(response.Awards, award => award.Id == "dxcc");
        var germany = Assert.Single(dxcc.Entities, entity => entity.Key == "230");

        Assert.Equal("confirmed", germany.Status);
        Assert.Equal(new[] { "LoTW", "QRZ" }, germany.ConfirmationSources);
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

        Assert.DoesNotContain(response.Awards, award => award.Id == "waz" && award.Status == "missing-data");
        Assert.Contains(response.Awards, award => award.Id == "pota" && award.Status == "active");
        Assert.Contains(response.Awards, award => award.Id == "sota" && award.Status == "active");
        Assert.Contains(response.Awards, award => award.Id == "iota" && award.Status == "active");
    }

    [Fact]
    public void CalculateSupportsCqAndItuZoneAwards()
    {
        var engine = new AwardEngine();
        var qsos = new[]
        {
            Qso("OZ1AAA", dxcc: 221, country: "Denmark", cqZone: 14, ituZone: 18, confirmed: true),
            Qso("K1ABC", dxcc: 291, country: "United States", cqZone: 5, ituZone: 8)
        };

        var response = engine.Calculate(qsos, new AwardQuery());
        var waz = Assert.Single(response.Awards, award => award.Id == "waz");
        var itu = Assert.Single(response.Awards, award => award.Id == "itu-zones");

        Assert.Equal("active", waz.Status);
        Assert.Equal(2, waz.WorkedCount);
        Assert.Equal(1, waz.ConfirmedCount);
        Assert.Equal(38, waz.MissingCount);
        Assert.Contains(waz.Entities, entity => entity.Key == "14" && entity.Status == "confirmed");
        Assert.Contains(waz.Entities, entity => entity.Key == "5" && entity.Status == "worked");

        Assert.Equal("active", itu.Status);
        Assert.Equal(2, itu.WorkedCount);
        Assert.Equal(73, itu.MissingCount);
        Assert.Contains(itu.Entities, entity => entity.Key == "18");
        Assert.Contains(itu.Entities, entity => entity.Key == "8");
    }

    [Fact]
    public void CalculateSupportsUsStatesAndCanadianProvinces()
    {
        var engine = new AwardEngine();
        var qsos = new[]
        {
            Qso("K1ABC", dxcc: 291, country: "United States", state: "MA", confirmed: true),
            Qso("VE3XYZ", dxcc: 1, country: "Canada", state: "ON"),
            Qso("OZ1AAA", dxcc: 221, country: "Denmark", state: "DK")
        };

        var response = engine.Calculate(qsos, new AwardQuery());
        var was = Assert.Single(response.Awards, award => award.Id == "was");
        var canada = Assert.Single(response.Awards, award => award.Id == "canada-provinces");

        Assert.Equal("active", was.Status);
        Assert.Equal(1, was.WorkedCount);
        Assert.Equal(1, was.ConfirmedCount);
        Assert.Equal(49, was.MissingCount);
        Assert.Contains(was.Entities, entity => entity.Key == "MA" && entity.Label == "MA");
        Assert.DoesNotContain(was.Entities, entity => entity.Key == "ON");

        Assert.Equal("active", canada.Status);
        Assert.Equal(1, canada.WorkedCount);
        Assert.Equal(0, canada.ConfirmedCount);
        Assert.Equal(12, canada.MissingCount);
        Assert.Contains(canada.Entities, entity => entity.Key == "ON" && entity.Label == "ON");
        Assert.DoesNotContain(canada.Entities, entity => entity.Key == "DK");
    }

    [Fact]
    public void CalculateSupportsIotaPotaSotaAndCountyAwards()
    {
        var engine = new AwardEngine();
        var qsos = new[]
        {
            Qso(
                "OZ1AAA",
                dxcc: 221,
                country: "Denmark",
                iota: "eu-029",
                potaRefs: "DK-0001, DK-0002",
                sotaRefs: "OZ/OZ-001; OZ/OZ-002",
                county: "DK-AR",
                confirmed: true),
            Qso(
                "K1ABC",
                dxcc: 291,
                country: "United States",
                potaRefs: "US-1234 US-5678",
                county: "MA-Middlesex")
        };

        var response = engine.Calculate(qsos, new AwardQuery());
        var iota = Assert.Single(response.Awards, award => award.Id == "iota");
        var pota = Assert.Single(response.Awards, award => award.Id == "pota");
        var sota = Assert.Single(response.Awards, award => award.Id == "sota");
        var counties = Assert.Single(response.Awards, award => award.Id == "counties");

        Assert.Equal("active", iota.Status);
        Assert.Equal(1, iota.WorkedCount);
        Assert.Equal(1, iota.ConfirmedCount);
        Assert.Contains(iota.Entities, entity => entity.Key == "EU-029" && entity.Status == "confirmed");

        Assert.Equal("active", pota.Status);
        Assert.Equal(4, pota.WorkedCount);
        Assert.Equal(2, pota.ConfirmedCount);
        Assert.Contains(pota.Entities, entity => entity.Key == "DK-0001" && entity.Status == "confirmed");
        Assert.Contains(pota.Entities, entity => entity.Key == "US-1234" && entity.Status == "worked");

        Assert.Equal("active", sota.Status);
        Assert.Equal(2, sota.WorkedCount);
        Assert.Equal(2, sota.ConfirmedCount);
        Assert.Contains(sota.Entities, entity => entity.Key == "OZ/OZ-001");

        Assert.Equal("active", counties.Status);
        Assert.Equal(2, counties.WorkedCount);
        Assert.Equal(1, counties.ConfirmedCount);
        Assert.Contains(counties.Entities, entity => entity.Key == "DK-AR");
        Assert.Contains(counties.Entities, entity => entity.Key == "MA-MIDDLESEX");
    }

    private static QsoEntry Qso(
        string callsign,
        int dxcc,
        string country,
        string continent = "EU",
        string? locator = null,
        Band band = Band.M20,
        Mode mode = Mode.FT8,
        int? cqZone = null,
        int? ituZone = null,
        string? state = null,
        string? county = null,
        string? iota = null,
        string? potaRefs = null,
        string? sotaRefs = null,
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
            CqZone = cqZone,
            ItuZone = ituZone,
            State = state,
            County = county,
            Iota = iota,
            PotaRefs = potaRefs,
            SotaRefs = sotaRefs,
            Locator = locator,
            LotwConfirmedAt = confirmed ? new DateTime(2026, 6, 17, 11, 0, 0, DateTimeKind.Utc) : null
        };
    }
}
