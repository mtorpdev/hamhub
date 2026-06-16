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
        var user = new ApplicationUser { QrzApiKey = "protected", QrzLastSyncedAt = new DateTime(2026, 6, 16, 8, 0, 0, DateTimeKind.Utc) };

        var statuses = QsoExternalLogStatusBuilder.Build(qso, user);

        var qrz = Assert.Single(statuses, status => status.Provider == "QRZ");
        Assert.Equal("synced", qrz.Status);
        Assert.Equal("Registreret på QRZ", qrz.Label);
        Assert.Equal("12345", qrz.ExternalId);
        Assert.False(qrz.CanSend);
        Assert.True(qrz.CanFetch);
        Assert.True(qrz.IsConfigured);
        Assert.Equal("Synkroniser QRZ", qrz.SendActionLabel);
        Assert.Equal(user.QrzLastSyncedAt, qrz.LastUpdatedAt);
    }

    [Fact]
    public void BuildMarksQrzNotConfiguredWhenApiKeyIsMissing()
    {
        var qso = new QsoEntry();
        var user = new ApplicationUser();

        var statuses = QsoExternalLogStatusBuilder.Build(qso, user);

        var qrz = Assert.Single(statuses, status => status.Provider == "QRZ");
        Assert.Equal("not-configured", qrz.Status);
        Assert.Equal("QRZ Logbook ikke sat op", qrz.Label);
        Assert.False(qrz.CanSend);
        Assert.False(qrz.CanFetch);
        Assert.False(qrz.IsConfigured);
        Assert.Equal("Opsæt QRZ", qrz.SendActionLabel);
    }

    [Fact]
    public void BuildMarksQrzReadyWhenApiKeyExistsAndQsoHasNoQrzId()
    {
        var qso = new QsoEntry();
        var user = new ApplicationUser { QrzApiKey = "protected" };

        var statuses = QsoExternalLogStatusBuilder.Build(qso, user);

        var qrz = Assert.Single(statuses, status => status.Provider == "QRZ");
        Assert.Equal("ready", qrz.Status);
        Assert.Equal("Klar til QRZ sync", qrz.Label);
        Assert.True(qrz.CanSend);
        Assert.True(qrz.CanFetch);
        Assert.True(qrz.IsConfigured);
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
        Assert.False(eqsl.CanFetch);
        Assert.True(eqsl.IsConfigured);
        Assert.Equal("Send til eQSL", eqsl.SendActionLabel);
        Assert.Equal("Opdater status", eqsl.FetchActionLabel);
    }

    [Fact]
    public void BuildMarksEqslSentWhenQsoHasEqslSentAt()
    {
        var qso = new QsoEntry
        {
            EqslSentAt = new DateTime(2026, 6, 15, 12, 0, 0, DateTimeKind.Utc),
            EqslLastResult = "Result: 1 out of 1 records added"
        };
        var user = new ApplicationUser { EqslUsername = "OZ1ABC", EqslPassword = "protected" };

        var statuses = QsoExternalLogStatusBuilder.Build(qso, user);

        var eqsl = Assert.Single(statuses, status => status.Provider == "eQSL");
        Assert.Equal("sent", eqsl.Status);
        Assert.Equal("Sendt til eQSL", eqsl.Label);
        Assert.False(eqsl.CanSend);
        Assert.False(eqsl.CanFetch);
        Assert.Equal(qso.EqslSentAt, eqsl.LastUpdatedAt);
        Assert.Equal(qso.EqslLastResult, eqsl.LastResult);
    }
}
