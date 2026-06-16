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
        bool? eqslCredentialReadable = null)
    {
        var qrzSynced = !string.IsNullOrWhiteSpace(qso.QrzId);
        var qrzStored = !string.IsNullOrWhiteSpace(user.QrzApiKey);
        var qrzConfigured = qrzStored && (qrzCredentialReadable ?? true);
        var qrzUnreadable = qrzStored && qrzCredentialReadable == false;
        var eqslConfigured = !string.IsNullOrWhiteSpace(user.EqslUsername) && !string.IsNullOrWhiteSpace(user.EqslPassword);
        var eqslReady = eqslConfigured && (eqslCredentialReadable ?? true);
        var eqslUnreadable = eqslConfigured && eqslCredentialReadable == false;
        var eqslSent = qso.EqslSentAt.HasValue;

        return new[]
        {
            new QsoExternalLogStatusDto(
                Provider: "QRZ",
                Status: qrzUnreadable ? "credential-error" : !qrzConfigured ? "not-configured" : qrzSynced ? "synced" : "ready",
                Label: qrzUnreadable ? "QRZ nøgle skal gemmes igen" : !qrzConfigured ? "QRZ Logbook ikke sat op" : qrzSynced ? "Registreret på QRZ" : "Klar til QRZ sync",
                ExternalId: qso.QrzId,
                CanSend: qrzConfigured && !qrzSynced,
                CanFetch: qrzConfigured,
                Description: qrzUnreadable
                    ? "Den gemte QRZ Logbook API nøgle kan ikke læses efter serverens nøgleskift. Gem QRZ nøglen igen på profilen."
                    : !qrzConfigured
                    ? "Gem QRZ Logbook API nøglen på profilen for at synkronisere QSO'er med QRZ."
                    : qrzSynced
                    ? "Denne QSO er koblet til en QRZ Logbook post."
                    : "QRZ sync henter først din logbog og sender derefter lokale QSO'er, der mangler en QRZ reference.",
                IsConfigured: qrzConfigured,
                SendActionLabel: qrzConfigured ? "Synkroniser QRZ" : "Opsæt QRZ",
                FetchActionLabel: "Hent/sync QRZ",
                LastUpdatedAt: user.QrzLastSyncedAt,
                LastResult: qrzSynced ? "QSO er koblet til QRZ Logbook." : null),
            new QsoExternalLogStatusDto(
                Provider: "LoTW",
                Status: "not-configured",
                Label: "Kræver TQSL/lokal agent",
                ExternalId: null,
                CanSend: false,
                CanFetch: false,
                Description: "LoTW accepterer signerede logs via TrustedQSL/TQSL. HamHub skal derfor bruge den lokale agent til signering, før direkte upload kan aktiveres.",
                IsConfigured: false,
                SendActionLabel: "Kommer senere",
                FetchActionLabel: "Kommer senere",
                LastUpdatedAt: null,
                LastResult: "Ikke aktiv endnu, fordi LoTW kræver certifikat og station location i TQSL."),
            new QsoExternalLogStatusDto(
                Provider: "eQSL",
                Status: eqslUnreadable ? "credential-error" : !eqslReady ? "not-configured" : eqslSent ? "sent" : "ready",
                Label: eqslUnreadable ? "eQSL login skal gemmes igen" : !eqslReady ? "Ikke sat op" : eqslSent ? "Sendt til eQSL" : "Klar til eQSL",
                ExternalId: null,
                CanSend: eqslReady && !eqslSent,
                CanFetch: false,
                Description: eqslUnreadable
                    ? "Det gemte eQSL login kan ikke læses efter serverens nøgleskift. Gem eQSL login igen på profilen, så bliver det krypteret med den nye persistente nøgle."
                    : !eqslReady
                    ? "Gem eQSL brugernavn og adgangskode på profilen for at sende QSO'er til eQSL."
                    : eqslSent
                        ? $"Denne QSO er sendt til eQSL{(qso.EqslSentAt.HasValue ? $" {qso.EqslSentAt.Value:yyyy-MM-dd HH:mm} UTC" : "")}."
                        : "Denne QSO kan sendes direkte til eQSL via real-time ADIF upload.",
                IsConfigured: eqslReady,
                SendActionLabel: eqslSent ? "Sendt" : eqslReady ? "Send til eQSL" : "Opsæt eQSL",
                FetchActionLabel: "Opdater status",
                LastUpdatedAt: qso.EqslSentAt ?? user.EqslLastSyncedAt,
                LastResult: qso.EqslLastResult),
        };
    }
}
