using HamHub.Api.Services;
using HamHub.Domain.Entities;
using Xunit;

namespace HamHub.Api.Tests;

public class QsoExternalLogStatusBuilderTests
{
    [Fact]
    public void BuildMarksQrzSyncedWhenQsoHasQrzId()
    {
        var qso = new QsoEntry { QrzId = "12345" };
        var user = new ApplicationUser();

        var statuses = QsoExternalLogStatusBuilder.Build(qso, user);

        var qrz = Assert.Single(statuses, status => status.Provider == "QRZ");
        Assert.Equal("synced", qrz.Status);
        Assert.Equal("Registreret på QRZ", qrz.Label);
        Assert.Equal("12345", qrz.ExternalId);
        Assert.False(qrz.CanSend);
        Assert.True(qrz.CanFetch);
    }

    [Fact]
    public void BuildMarksQrzReadyWhenQsoHasNoQrzId()
    {
        var qso = new QsoEntry();
        var user = new ApplicationUser();

        var statuses = QsoExternalLogStatusBuilder.Build(qso, user);

        var qrz = Assert.Single(statuses, status => status.Provider == "QRZ");
        Assert.Equal("ready", qrz.Status);
        Assert.Equal("Ikke sendt til QRZ", qrz.Label);
        Assert.True(qrz.CanSend);
        Assert.True(qrz.CanFetch);
    }

    [Fact]
    public void BuildMarksEqslReadyWhenCredentialsExistAndQsoIsNotSent()
    {
        var qso = new QsoEntry();
        var user = new ApplicationUser { EqslUsername = "OZ1ABC", EqslPassword = "protected" };

        var statuses = QsoExternalLogStatusBuilder.Build(qso, user);

        var eqsl = Assert.Single(statuses, status => status.Provider == "eQSL");
        Assert.Equal("ready", eqsl.Status);
        Assert.Equal("Klar til eQSL", eqsl.Label);
        Assert.True(eqsl.CanSend);
        Assert.True(eqsl.CanFetch);
    }

    [Fact]
    public void BuildMarksEqslSentWhenQsoHasEqslSentAt()
    {
        var qso = new QsoEntry { EqslSentAt = new DateTime(2026, 6, 15, 12, 0, 0, DateTimeKind.Utc) };
        var user = new ApplicationUser { EqslUsername = "OZ1ABC", EqslPassword = "protected" };

        var statuses = QsoExternalLogStatusBuilder.Build(qso, user);

        var eqsl = Assert.Single(statuses, status => status.Provider == "eQSL");
        Assert.Equal("sent", eqsl.Status);
        Assert.Equal("Sendt til eQSL", eqsl.Label);
        Assert.False(eqsl.CanSend);
        Assert.True(eqsl.CanFetch);
    }
}
