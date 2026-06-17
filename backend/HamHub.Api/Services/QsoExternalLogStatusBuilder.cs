using HamHub.Domain.Entities;

namespace HamHub.Api.Services;

public sealed record QsoExternalLogStatusDto(
    string Provider,
    string Status,
    string Label,
    string? ExternalId,
    bool CanSend,
    bool CanFetch,
    string Description,
    bool IsConfigured,
    string SendActionLabel,
    string FetchActionLabel,
    DateTime? LastUpdatedAt,
    string? LastResult);

public static class QsoExternalLogStatusBuilder
{
    public static IReadOnlyList<QsoExternalLogStatusDto> Build(
        QsoEntry qso,
        ApplicationUser user,
        bool? qrzCredentialReadable = null,
        bool? eqslCredentialReadable = null,
        bool? lotwCredentialReadable = null)
    {
        var qrzSynced = !string.IsNullOrWhiteSpace(qso.QrzId);
        var qrzStored = !string.IsNullOrWhiteSpace(user.QrzApiKey);
        var qrzConfigured = qrzStored && (qrzCredentialReadable ?? true);
        var qrzUnreadable = qrzStored && qrzCredentialReadable == false;
        var qrzConfirmed = qso.QrzConfirmedAt.HasValue || string.Equals(qso.QrzConfirmationStatus, "C", StringComparison.OrdinalIgnoreCase);
        var qrzStatus = QrzStatusText(qso.QrzConfirmationStatus);

        var lotwStored = !string.IsNullOrWhiteSpace(user.LotwUsername) && !string.IsNullOrWhiteSpace(user.LotwPassword);
        var lotwConfigured = lotwStored && (lotwCredentialReadable ?? true);
        var lotwUnreadable = lotwStored && lotwCredentialReadable == false;
        var lotwConfirmed = qso.LotwConfirmedAt.HasValue;
        var lotwChecked = qso.LotwLastResult?.StartsWith("LoTW status opdateret:", StringComparison.OrdinalIgnoreCase) == true;

        var eqslConfigured = !string.IsNullOrWhiteSpace(user.EqslUsername) && !string.IsNullOrWhiteSpace(user.EqslPassword);
        var eqslReady = eqslConfigured && (eqslCredentialReadable ?? true);
        var eqslUnreadable = eqslConfigured && eqslCredentialReadable == false;
        var eqslSent = qso.EqslSentAt.HasValue;
        var eqslConfirmed = qso.EqslConfirmedAt.HasValue;
        var eqslChecked = qso.EqslLastResult?.StartsWith("eQSL status opdateret:", StringComparison.OrdinalIgnoreCase) == true;
        var eqslMissing = eqslChecked && !eqslSent && !eqslConfirmed;

        return new[]
        {
            new QsoExternalLogStatusDto(
                Provider: "QRZ",
                Status: qrzUnreadable ? "credential-error" : !qrzConfigured ? "not-configured" : qrzConfirmed ? "confirmed" : qrzSynced ? "synced" : "ready",
                Label: qrzUnreadable ? "QRZ nøgle skal gemmes igen" : !qrzConfigured ? "QRZ Logbook ikke sat op" : qrzConfirmed ? "Bekræftet på QRZ" : qrzSynced ? "Registreret på QRZ" : "Klar til QRZ sync",
                ExternalId: qso.QrzId,
                CanSend: qrzConfigured && !qrzSynced,
                CanFetch: qrzConfigured,
                Description: qrzUnreadable
                    ? "Den gemte QRZ Logbook API nøgle kan ikke læses efter serverens nøgleskift. Gem QRZ nøglen igen på profilen."
                    : !qrzConfigured
                    ? "Gem QRZ Logbook API nøglen på profilen for at synkronisere QSO'er med QRZ."
                    : qrzConfirmed
                    ? $"Modparten har et matchende QRZ Logbook QSO, så kontakten er bekræftet{(qso.QrzQslDate.HasValue ? $" {qso.QrzQslDate.Value:yyyy-MM-dd} UTC" : "")}."
                    : qrzSynced
                    ? "Denne QSO er koblet til en QRZ Logbook post, men er ikke bekræftet af modparten endnu."
                    : "QRZ sync henter først din logbog og sender derefter lokale QSO'er, der mangler en QRZ reference.",
                IsConfigured: qrzConfigured,
                SendActionLabel: qrzConfigured ? "Synkroniser QRZ" : "Opsæt QRZ",
                FetchActionLabel: "Hent/sync QRZ",
                LastUpdatedAt: qso.QrzConfirmedAt ?? qso.QrzQslDate ?? user.QrzLastSyncedAt,
                LastResult: qrzSynced ? qrzStatus : null),
            new QsoExternalLogStatusDto(
                Provider: "LoTW",
                Status: lotwUnreadable ? "credential-error" : !lotwConfigured ? "not-configured" : lotwConfirmed ? "confirmed" : lotwChecked ? "missing" : "ready",
                Label: lotwUnreadable ? "LoTW login skal gemmes igen" : !lotwConfigured ? "LoTW ikke sat op" : lotwConfirmed ? "Bekræftet på LoTW" : lotwChecked ? "Ikke bekræftet på LoTW" : "Klar til LoTW sync",
                ExternalId: null,
                CanSend: false,
                CanFetch: lotwConfigured,
                Description: lotwUnreadable
                    ? "Det gemte LoTW login kan ikke læses efter serverens nøgleskift. Gem LoTW login igen på profilen."
                    : !lotwConfigured
                    ? "Gem LoTW brugernavn og adgangskode på profilen for at hente bekræftelser fra LoTW."
                    : lotwConfirmed
                    ? $"LoTW har en matchende bekræftelse for denne QSO{(qso.LotwQslDate.HasValue ? $" {qso.LotwQslDate.Value:yyyy-MM-dd} UTC" : "")}."
                    : lotwChecked
                    ? "Denne QSO er tjekket mod LoTW, men er ikke bekræftet endnu."
                    : "LoTW sync henter bekræftede QSL records og matcher dem mod dine lokale QSOer på call, tidspunkt, bånd og mode.",
                IsConfigured: lotwConfigured,
                SendActionLabel: "Kræver TQSL",
                FetchActionLabel: lotwConfigured ? "Hent LoTW" : "Opsæt LoTW",
                LastUpdatedAt: qso.LotwConfirmedAt ?? qso.LotwQslDate ?? user.LotwLastSyncedAt,
                LastResult: qso.LotwLastResult),
            new QsoExternalLogStatusDto(
                Provider: "eQSL",
                Status: eqslUnreadable ? "credential-error" : !eqslReady ? "not-configured" : eqslConfirmed ? "confirmed" : eqslSent ? "sent" : eqslMissing ? "missing" : "ready",
                Label: eqslUnreadable ? "eQSL login skal gemmes igen" : !eqslReady ? "Ikke sat op" : eqslConfirmed ? "Bekræftet på eQSL" : eqslSent ? "Sendt til eQSL" : eqslMissing ? "Ikke fundet på eQSL" : "Klar til eQSL",
                ExternalId: null,
                CanSend: eqslReady && !eqslSent,
                CanFetch: eqslReady,
                Description: eqslUnreadable
                    ? "Det gemte eQSL login kan ikke læses efter serverens nøgleskift. Gem eQSL login igen på profilen, så bliver det krypteret med den nye persistente nøgle."
                    : !eqslReady
                    ? "Gem eQSL brugernavn og adgangskode på profilen for at sende QSO'er til eQSL."
                    : eqslConfirmed
                        ? $"Modpartens eQSL er fundet og denne QSO er bekræftet{(qso.EqslConfirmedAt.HasValue ? $" {qso.EqslConfirmedAt.Value:yyyy-MM-dd HH:mm} UTC" : "")}."
                    : eqslSent
                        ? $"Denne QSO er sendt til eQSL{(qso.EqslSentAt.HasValue ? $" {qso.EqslSentAt.Value:yyyy-MM-dd HH:mm} UTC" : "")}."
                    : eqslMissing
                        ? "Denne QSO er tjekket hos eQSL, men blev ikke fundet endnu. Du kan sende den direkte herfra."
                        : "Denne QSO kan sendes direkte til eQSL via real-time ADIF upload.",
                IsConfigured: eqslReady,
                SendActionLabel: eqslSent ? "Sendt" : eqslReady ? "Send til eQSL" : "Opsæt eQSL",
                FetchActionLabel: "Opdater status",
                LastUpdatedAt: qso.EqslConfirmedAt ?? qso.EqslSentAt ?? user.EqslLastSyncedAt,
                LastResult: qso.EqslLastResult),
        };
    }

    private static string QrzStatusText(string? status) => status?.ToUpperInvariant() switch
    {
        "C" => "QRZ status: Confirmed af modparten.",
        "A" => "QRZ status: reserveret/ukendt QRZ-status.",
        "N" => "QRZ status: ikke bekræftet endnu.",
        "2" => "QRZ status: confirmation requested.",
        "S" => "QRZ status: confirmation requested, set af modparten.",
        "R" => "QRZ status: confirmation request afvist.",
        _ => "QRZ status: QSO er koblet til QRZ Logbook."
    };
}
