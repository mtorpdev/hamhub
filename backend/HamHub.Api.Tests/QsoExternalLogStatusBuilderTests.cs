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
    public void BuildMarksQrzConfirmedWhenQrzStatusIsConfirmed()
    {
        var qso = new QsoEntry
        {
            QrzId = "12345",
            QrzConfirmationStatus = "C",
            QrzQslDate = new DateTime(2026, 6, 16, 0, 0, 0, DateTimeKind.Utc),
            QrzConfirmedAt = new DateTime(2026, 6, 16, 0, 0, 0, DateTimeKind.Utc)
        };
        var user = new ApplicationUser { QrzApiKey = "protected" };

        var statuses = QsoExternalLogStatusBuilder.Build(qso, user);

        var qrz = Assert.Single(statuses, status => status.Provider == "QRZ");
        Assert.Equal("confirmed", qrz.Status);
        Assert.Equal("Bekræftet på QRZ", qrz.Label);
        Assert.False(qrz.CanSend);
        Assert.True(qrz.CanFetch);
        Assert.Equal(qso.QrzConfirmedAt, qrz.LastUpdatedAt);
        Assert.Contains("Confirmed", qrz.LastResult);
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
        Assert.True(eqsl.CanFetch);
        Assert.Equal(qso.EqslSentAt, eqsl.LastUpdatedAt);
        Assert.Equal(qso.EqslLastResult, eqsl.LastResult);
    }

    [Fact]
    public void BuildMarksEqslConfirmedWhenQsoHasEqslConfirmedAt()
    {
        var qso = new QsoEntry
        {
            EqslSentAt = new DateTime(2026, 6, 15, 12, 0, 0, DateTimeKind.Utc),
            EqslConfirmedAt = new DateTime(2026, 6, 16, 9, 30, 0, DateTimeKind.Utc),
            EqslLastResult = "eQSL status opdateret: sendt og bekræftet."
        };
        var user = new ApplicationUser { EqslUsername = "OZ1ABC", EqslPassword = "protected" };

        var statuses = QsoExternalLogStatusBuilder.Build(qso, user);

        var eqsl = Assert.Single(statuses, status => status.Provider == "eQSL");
        Assert.Equal("confirmed", eqsl.Status);
        Assert.Equal("Bekræftet på eQSL", eqsl.Label);
        Assert.False(eqsl.CanSend);
        Assert.True(eqsl.CanFetch);
        Assert.Equal(qso.EqslConfirmedAt, eqsl.LastUpdatedAt);
        Assert.Equal(qso.EqslLastResult, eqsl.LastResult);
    }

    [Fact]
    public void BuildKeepsEqslReadyWhenStatusWasCheckedButQsoWasNotFound()
    {
        var qso = new QsoEntry
        {
            EqslLastResult = "eQSL status opdateret: QSO ikke fundet på eQSL endnu. QSO ikke fundet på eQSL endnu."
        };
        var user = new ApplicationUser { EqslUsername = "OZ1ABC", EqslPassword = "protected" };

        var statuses = QsoExternalLogStatusBuilder.Build(qso, user);

        var eqsl = Assert.Single(statuses, status => status.Provider == "eQSL");
        Assert.Equal("ready", eqsl.Status);
        Assert.Equal("Klar til eQSL", eqsl.Label);
        Assert.True(eqsl.CanSend);
        Assert.True(eqsl.CanFetch);
        Assert.Contains("sende den direkte", eqsl.Description);
    }

    [Fact]
    public void BuildMarksEqslCredentialErrorWhenStoredPasswordCannotBeRead()
    {
        var qso = new QsoEntry();
        var user = new ApplicationUser { EqslUsername = "OZ1ABC", EqslPassword = "old-keyring-value" };

        var statuses = QsoExternalLogStatusBuilder.Build(qso, user, eqslCredentialReadable: false);

        var eqsl = Assert.Single(statuses, status => status.Provider == "eQSL");
        Assert.Equal("credential-error", eqsl.Status);
        Assert.Equal("eQSL login skal gemmes igen", eqsl.Label);
        Assert.False(eqsl.CanSend);
        Assert.False(eqsl.IsConfigured);
        Assert.Contains("Gem eQSL login igen", eqsl.Description);
    }

    [Fact]
    public void BuildMarksQrzCredentialErrorWhenStoredApiKeyCannotBeRead()
    {
        var qso = new QsoEntry();
        var user = new ApplicationUser { QrzApiKey = "old-keyring-value" };

        var statuses = QsoExternalLogStatusBuilder.Build(qso, user, qrzCredentialReadable: false);

        var qrz = Assert.Single(statuses, status => status.Provider == "QRZ");
        Assert.Equal("credential-error", qrz.Status);
        Assert.Equal("QRZ nøgle skal gemmes igen", qrz.Label);
        Assert.False(qrz.CanSend);
        Assert.False(qrz.CanFetch);
        Assert.False(qrz.IsConfigured);
    }

    [Fact]
    public void BuildMarksLotwConfirmedWhenQsoHasLotwConfirmation()
    {
        var qso = new QsoEntry
        {
            LotwConfirmedAt = new DateTime(2026, 6, 17, 8, 10, 11, DateTimeKind.Utc),
            LotwQslDate = new DateTime(2026, 6, 17, 0, 0, 0, DateTimeKind.Utc),
            LotwLastResult = "LoTW bekræftet 2026-06-17 UTC"
        };
        var user = new ApplicationUser { LotwUsername = "OZ1ABC", LotwPassword = "protected" };

        var statuses = QsoExternalLogStatusBuilder.Build(qso, user, lotwCredentialReadable: true);

        var lotw = Assert.Single(statuses, status => status.Provider == "LoTW");
        Assert.Equal("confirmed", lotw.Status);
        Assert.Equal("Bekræftet på LoTW", lotw.Label);
        Assert.False(lotw.CanSend);
        Assert.True(lotw.CanFetch);
        Assert.True(lotw.IsConfigured);
        Assert.Equal(qso.LotwConfirmedAt, lotw.LastUpdatedAt);
        Assert.Equal(qso.LotwLastResult, lotw.LastResult);
    }
}
