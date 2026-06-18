using HamHub.Api.Services;
using HamHub.Domain.Entities;
using HamHub.Domain.Enums;
using HamHub.Infrastructure.Services;
using Xunit;

namespace HamHub.Api.Tests;

public class QrzSyncServiceTests
{
    [Fact]
    public void ApplyFetchedQrzFieldsFillsMissingAwardFields()
    {
        var qso = new QsoEntry
        {
            WorkedCallsign = "OZ1AAA"
        };
        var qrz = QrzQso(
            country: "Denmark",
            dxcc: 221,
            continent: "EU",
            state: "82",
            county: "DK-AR",
            iota: "EU-029",
            potaRefs: "DK-0001",
            sotaRefs: "OZ/OZ-001",
            awardRefs: "SPECIAL-2026");

        QrzSyncService.ApplyFetchedQrzFields(qso, qrz);

        Assert.Equal("Denmark", qso.Country);
        Assert.Equal(221, qso.Dxcc);
        Assert.Equal("EU", qso.Continent);
        Assert.Equal("82", qso.State);
        Assert.Equal("DK-AR", qso.County);
        Assert.Equal("EU-029", qso.Iota);
        Assert.Equal("DK-0001", qso.PotaRefs);
        Assert.Equal("OZ/OZ-001", qso.SotaRefs);
        Assert.Equal("SPECIAL-2026", qso.AwardRefs);
    }

    [Fact]
    public void ApplyFetchedQrzFieldsDoesNotOverwriteExistingAwardFields()
    {
        var qso = new QsoEntry
        {
            Country = "Local Country",
            Dxcc = 999,
            Continent = "XX",
            State = "LOCAL",
            County = "LOCAL-COUNTY",
            Iota = "LOCAL-IOTA",
            PotaRefs = "LOCAL-POTA",
            SotaRefs = "LOCAL-SOTA",
            AwardRefs = "LOCAL-AWARD"
        };
        var qrz = QrzQso(
            country: "Denmark",
            dxcc: 221,
            continent: "EU",
            state: "82",
            county: "DK-AR",
            iota: "EU-029",
            potaRefs: "DK-0001",
            sotaRefs: "OZ/OZ-001",
            awardRefs: "SPECIAL-2026");

        QrzSyncService.ApplyFetchedQrzFields(qso, qrz);

        Assert.Equal("Local Country", qso.Country);
        Assert.Equal(999, qso.Dxcc);
        Assert.Equal("XX", qso.Continent);
        Assert.Equal("LOCAL", qso.State);
        Assert.Equal("LOCAL-COUNTY", qso.County);
        Assert.Equal("LOCAL-IOTA", qso.Iota);
        Assert.Equal("LOCAL-POTA", qso.PotaRefs);
        Assert.Equal("LOCAL-SOTA", qso.SotaRefs);
        Assert.Equal("LOCAL-AWARD", qso.AwardRefs);
    }

    [Fact]
    public void ToQrzAdifUsesLocalQsoValuesForTargetedUpload()
    {
        var qso = new QsoEntry
        {
            WorkedCallsign = "K1ABC",
            DateUtc = new DateTime(2026, 6, 18, 8, 15, 0, DateTimeKind.Utc),
            Band = Band.M20,
            Mode = Mode.FT8,
            RstSent = "-10",
            RstReceived = "-12",
            Locator = "FN31",
            Country = "United States",
            Dxcc = 291,
            Continent = "NA",
            State = "CT",
            County = "HARTFORD",
            Comment = "Targeted upload"
        };

        var adif = QrzSyncService.ToQrzAdif(qso);

        Assert.Equal("K1ABC", adif.Call);
        Assert.Equal(qso.DateUtc, adif.TimeOn);
        Assert.Equal("20M", adif.Band);
        Assert.Equal("FT8", adif.Mode);
        Assert.Equal("FN31", adif.Gridsquare);
        Assert.Equal(291, adif.Dxcc);
        Assert.Null(adif.LogId);
    }

    [Fact]
    public void CreateImportedQsoUsesQrzFieldsForTargetedImport()
    {
        var qrz = QrzQso(
            country: "Denmark",
            dxcc: 221,
            continent: "EU",
            state: "82",
            county: "DK-AR",
            iota: "EU-029",
            potaRefs: "DK-0001",
            sotaRefs: "OZ/OZ-001",
            awardRefs: "SPECIAL-2026");

        var qso = QrzSyncService.CreateImportedQso("user-1", "OZ4MT", qrz);

        Assert.Equal("user-1", qso.UserId);
        Assert.Equal("OZ4MT", qso.OwnCallsign);
        Assert.Equal("OZ1AAA", qso.WorkedCallsign);
        Assert.Equal(qrz.TimeOn, qso.DateUtc);
        Assert.Equal(Band.M20, qso.Band);
        Assert.Equal(Mode.FT8, qso.Mode);
        Assert.Equal("123", qso.QrzId);
        Assert.Equal("DK-AR", qso.County);
    }

    [Fact]
    public void ApplyQrzTimeUpdatesLocalTimestampAndLinksQrzRecord()
    {
        var qso = new QsoEntry
        {
            WorkedCallsign = "OZ1AAA",
            DateUtc = new DateTime(2026, 6, 17, 10, 0, 0, DateTimeKind.Utc),
            Band = Band.M20,
            Mode = Mode.FT8
        };
        var qrz = QrzQso(dxcc: 221);

        QrzSyncService.ApplyQrzTime(qso, qrz);

        Assert.Equal(qrz.TimeOn, qso.DateUtc);
        Assert.Equal("123", qso.QrzId);
        Assert.Equal(221, qso.Dxcc);
    }

    private static AdifQso QrzQso(
        string? country = null,
        int? dxcc = null,
        string? continent = null,
        string? state = null,
        string? county = null,
        string? iota = null,
        string? potaRefs = null,
        string? sotaRefs = null,
        string? awardRefs = null) => new(
            Call: "OZ1AAA",
            TimeOn: new DateTime(2026, 6, 17, 12, 0, 0, DateTimeKind.Utc),
            Band: "20M",
            Mode: "FT8",
            RstSent: null,
            RstReceived: null,
            Submode: null,
            Gridsquare: null,
            MyGridsquare: null,
            Country: country,
            Dxcc: dxcc,
            Continent: continent,
            State: state,
            County: county,
            Iota: iota,
            PotaRefs: potaRefs,
            SotaRefs: sotaRefs,
            AwardRefs: awardRefs,
            Name: null,
            Qth: null,
            TxPower: null,
            Comment: null,
            LogId: "123",
            QrzStatus: null,
            QrzQslDate: null);
}
