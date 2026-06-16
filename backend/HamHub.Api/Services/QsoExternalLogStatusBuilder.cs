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
    public static IReadOnlyList<QsoExternalLogStatusDto> Build(QsoEntry qso, ApplicationUser user)
    {
        var qrzSynced = !string.IsNullOrWhiteSpace(qso.QrzId);
        var qrzConfigured = !string.IsNullOrWhiteSpace(user.QrzApiKey);
        var eqslConfigured = !string.IsNullOrWhiteSpace(user.EqslUsername) && !string.IsNullOrWhiteSpace(user.EqslPassword);
        var eqslSent = qso.EqslSentAt.HasValue;

        return new[]
        {
            new QsoExternalLogStatusDto(
                Provider: "QRZ",
                Status: !qrzConfigured ? "not-configured" : qrzSynced ? "synced" : "ready",
                Label: !qrzConfigured ? "QRZ Logbook ikke sat op" : qrzSynced ? "Registreret på QRZ" : "Klar til QRZ sync",
                ExternalId: qso.QrzId,
                CanSend: qrzConfigured && !qrzSynced,
                CanFetch: qrzConfigured,
                Description: !qrzConfigured
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
                Status: !eqslConfigured ? "not-configured" : eqslSent ? "sent" : "ready",
                Label: !eqslConfigured ? "Ikke sat op" : eqslSent ? "Sendt til eQSL" : "Klar til eQSL",
                ExternalId: null,
                CanSend: eqslConfigured && !eqslSent,
                CanFetch: false,
                Description: !eqslConfigured
                    ? "Gem eQSL brugernavn og adgangskode på profilen for at sende QSO'er til eQSL."
                    : eqslSent
                        ? $"Denne QSO er sendt til eQSL{(qso.EqslSentAt.HasValue ? $" {qso.EqslSentAt.Value:yyyy-MM-dd HH:mm} UTC" : "")}."
                        : "Denne QSO kan sendes direkte til eQSL via real-time ADIF upload.",
                IsConfigured: eqslConfigured,
                SendActionLabel: eqslSent ? "Sendt" : eqslConfigured ? "Send til eQSL" : "Opsæt eQSL",
                FetchActionLabel: "Opdater status",
                LastUpdatedAt: qso.EqslSentAt ?? user.EqslLastSyncedAt,
                LastResult: qso.EqslLastResult),
        };
    }
}
