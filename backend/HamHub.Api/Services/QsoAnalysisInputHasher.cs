using System.Security.Cryptography;
using System.Text;
using HamHub.Domain.Entities;

namespace HamHub.Api.Services;

public static class QsoAnalysisInputHasher
{
    public static string Hash(
        QsoEntry qso,
        int analysisVersion,
        string? duplicateCandidatesHash = null,
        bool? qrzCredentialReadable = null,
        bool? eqslCredentialReadable = null,
        bool? lotwCredentialReadable = null)
    {
        var input = string.Join("|", new object?[]
        {
            analysisVersion,
            qso.DateUtc.ToUniversalTime().ToString("O"),
            qso.OwnCallsign,
            qso.WorkedCallsign,
            qso.Band,
            qso.Frequency,
            qso.Mode,
            qso.RstSent,
            qso.RstReceived,
            qso.Submode,
            qso.Locator,
            qso.MyGridsquare,
            qso.Country,
            qso.Dxcc,
            qso.Continent,
            qso.State,
            qso.CqZone,
            qso.ItuZone,
            qso.County,
            qso.Iota,
            qso.PotaRefs,
            qso.SotaRefs,
            qso.AwardRefs,
            qso.QrzId,
            qso.QrzConfirmationStatus,
            qso.QrzConfirmedAt?.ToUniversalTime().ToString("O"),
            qso.QrzQslDate?.ToUniversalTime().ToString("O"),
            qso.EqslSentAt?.ToUniversalTime().ToString("O"),
            qso.EqslConfirmedAt?.ToUniversalTime().ToString("O"),
            qso.LotwConfirmedAt?.ToUniversalTime().ToString("O"),
            qso.LotwQslDate?.ToUniversalTime().ToString("O"),
            qso.LotwLastResult,
            qso.TxPower,
            qso.User?.QrzApiKey is null ? null : "present",
            qso.User?.QrzLastSyncedAt?.ToUniversalTime().ToString("O"),
            qso.User?.EqslUsername,
            qso.User?.EqslPassword is null ? null : "present",
            qso.User?.EqslLastSyncedAt?.ToUniversalTime().ToString("O"),
            qso.User?.LotwUsername,
            qso.User?.LotwPassword is null ? null : "present",
            qso.User?.LotwLastSyncedAt?.ToUniversalTime().ToString("O"),
            qrzCredentialReadable,
            eqslCredentialReadable,
            lotwCredentialReadable,
            duplicateCandidatesHash
        });

        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(input)));
    }
}
