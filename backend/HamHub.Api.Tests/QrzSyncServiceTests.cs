using HamHub.Api.Services;
using HamHub.Domain.Entities;
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
