using HamHub.Domain.Entities;

namespace HamHub.Api.Services;

public sealed record QsoExternalLogStatusDto(
    string Provider,
    string Status,
    string Label,
    string? ExternalId,
    bool CanSend,
    bool CanFetch,
    string Description);

public static class QsoExternalLogStatusBuilder
{
    public static IReadOnlyList<QsoExternalLogStatusDto> Build(QsoEntry qso, ApplicationUser user)
    {
        var qrzSynced = !string.IsNullOrWhiteSpace(qso.QrzId);
        var eqslConfigured = !string.IsNullOrWhiteSpace(user.EqslUsername) && !string.IsNullOrWhiteSpace(user.EqslPassword);
        var eqslSent = qso.EqslSentAt.HasValue;

        return new[]
        {
            new QsoExternalLogStatusDto(
                Provider: "QRZ",
                Status: qrzSynced ? "synced" : "ready",
                Label: qrzSynced ? "Registreret på QRZ" : "Ikke sendt til QRZ",
                ExternalId: qso.QrzId,
                CanSend: !qrzSynced,
                CanFetch: true,
                Description: qrzSynced
                    ? "Denne QSO er koblet til en QRZ Logbook post."
                    : "QSO'en kan sendes til QRZ, hvis QRZ Logbook API er sat op på profilen."),
            new QsoExternalLogStatusDto(
                Provider: "LoTW",
                Status: "not-configured",
                Label: "Ikke sat op",
                ExternalId: null,
                CanSend: false,
                CanFetch: false,
                Description: "LoTW kræver TQSL/signering og bør kobles via en særskilt opsætning eller lokal agent."),
            new QsoExternalLogStatusDto(
                Provider: "eQSL",
                Status: !eqslConfigured ? "not-configured" : eqslSent ? "sent" : "ready",
                Label: !eqslConfigured ? "Ikke sat op" : eqslSent ? "Sendt til eQSL" : "Klar til eQSL",
                ExternalId: null,
                CanSend: eqslConfigured && !eqslSent,
                CanFetch: eqslConfigured,
                Description: !eqslConfigured
                    ? "Gem eQSL brugernavn og adgangskode på profilen for at sende QSO'er til eQSL."
                    : eqslSent
                        ? $"Denne QSO er sendt til eQSL{(qso.EqslSentAt.HasValue ? $" {qso.EqslSentAt.Value:yyyy-MM-dd HH:mm} UTC" : "")}."
                        : "Denne QSO kan sendes til eQSL via real-time ADIF upload."),
        };
    }
}
