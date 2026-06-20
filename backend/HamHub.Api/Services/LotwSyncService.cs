using HamHub.Domain.Entities;
using HamHub.Domain.Enums;
using HamHub.Infrastructure.Persistence;
using HamHub.Infrastructure.Services;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;

namespace HamHub.Api.Services;

public record LotwSyncResult(int Confirmed, int Unmatched, int CheckedNotFound, DateTime SyncedAtUtc);

public class LotwSyncService
{
    private readonly ApplicationDbContext _db;
    private readonly LotwReportClient _client;
    private readonly IDataProtector _protector;

    private static readonly Dictionary<string, Band> BandMap = new(StringComparer.OrdinalIgnoreCase)
    {
        ["160M"] = Band.M160, ["80M"] = Band.M80, ["60M"] = Band.M60, ["40M"] = Band.M40,
        ["30M"] = Band.M30, ["20M"] = Band.M20, ["17M"] = Band.M17, ["15M"] = Band.M15,
        ["12M"] = Band.M12, ["10M"] = Band.M10, ["6M"] = Band.M6, ["2M"] = Band.M2,
        ["70CM"] = Band.CM70
    };

    private static readonly Dictionary<string, Mode> ModeMap = new(StringComparer.OrdinalIgnoreCase)
    {
        ["SSB"] = Mode.SSB, ["USB"] = Mode.SSB, ["LSB"] = Mode.SSB,
        ["CW"] = Mode.CW, ["FT8"] = Mode.FT8, ["FT4"] = Mode.FT4,
        ["RTTY"] = Mode.RTTY, ["DMR"] = Mode.DMR, ["FM"] = Mode.FM, ["AM"] = Mode.AM
    };

    public LotwSyncService(
        ApplicationDbContext db,
        LotwReportClient client,
        IDataProtectionProvider dataProtectionProvider)
    {
        _db = db;
        _client = client;
        _protector = dataProtectionProvider.CreateProtector("LotwPassword");
    }

    public async Task<LotwSyncResult> SyncUserAsync(string userId, CancellationToken ct)
    {
        var user = await _db.Users.FindAsync([userId], ct);
        if (user == null) throw new InvalidOperationException("Brugeren blev ikke fundet.");
        if (string.IsNullOrWhiteSpace(user.LotwUsername) || string.IsNullOrWhiteSpace(user.LotwPassword))
            throw new LotwApiException("LoTW er ikke sat op på profilen.");

        string password;
        try
        {
            password = _protector.Unprotect(user.LotwPassword);
        }
        catch (CryptographicException)
        {
            throw new LotwApiException("LoTW login kunne ikke læses. Gem LoTW login igen på profilen.");
        }

        var previousLastSyncedAt = user.LotwLastSyncedAt;
        var isFullReport = true;
        var records = await _client.FetchConfirmedQsosAsync(user.LotwUsername, password, sinceUtc: null, ct);
        var confirmed = 0;
        var unmatched = 0;
        var checkedNotFound = 0;
        var matchedQsoIds = new HashSet<int>();
        var now = DateTime.UtcNow;

        foreach (var record in records)
        {
            if (!BandMap.TryGetValue(record.Band, out var band)) { unmatched++; continue; }
            if (!ModeMap.TryGetValue(record.Mode, out var mode)) { unmatched++; continue; }

            var lower = record.TimeOn.AddHours(-2).AddSeconds(-60);
            var upper = record.TimeOn.AddHours(2).AddSeconds(60);
            var candidates = await _db.QsoEntries.Where(q =>
                q.UserId == userId &&
                q.WorkedCallsign == record.Call &&
                q.DateUtc >= lower &&
                q.DateUtc <= upper &&
                q.Mode == mode)
                .OrderByDescending(q => q.UpdatedAt)
                .ToListAsync(ct);

            var match = candidates.FirstOrDefault(q => IsLotwMatch(q, userId, record, band, mode));

            if (match == null)
            {
                unmatched++;
                continue;
            }

            ApplyConfirmation(match, record, now);
            matchedQsoIds.Add(match.Id);
            confirmed++;
        }

        if (ShouldMarkNotFound(previousLastSyncedAt, isFullReport))
        {
            var notConfirmed = await _db.QsoEntries
                .Where(q =>
                    q.UserId == userId &&
                    q.LotwConfirmedAt == null &&
                    q.DateUtc <= now)
                .ToListAsync(ct);

            foreach (var qso in notConfirmed)
            {
                if (matchedQsoIds.Contains(qso.Id)) continue;
                if (MarkNotFound(qso, now)) checkedNotFound++;
            }
        }

        user.LotwLastSyncedAt = now;
        await _db.SaveChangesAsync(ct);
        return new LotwSyncResult(confirmed, unmatched, checkedNotFound, now);
    }

    public static void ApplyConfirmation(QsoEntry qso, LotwQslRecord record, DateTime nowUtc)
    {
        qso.LotwQslDate = record.QslDate ?? qso.LotwQslDate;
        qso.LotwConfirmedAt = record.ReceivedAt ?? record.QslDate ?? qso.LotwConfirmedAt ?? nowUtc;
        qso.LotwLastResult = qso.LotwQslDate.HasValue
            ? $"LoTW bekræftet {qso.LotwQslDate.Value:yyyy-MM-dd} UTC"
            : "LoTW bekræftet";
        ApplyFetchedLotwFields(qso, record);
        qso.UpdatedAt = nowUtc;
    }

    internal static void ApplyFetchedLotwFields(QsoEntry qso, LotwQslRecord record)
    {
        qso.Locator ??= record.Gridsquare;
        qso.Country ??= record.Country;
        qso.Dxcc ??= record.Dxcc;
        qso.Continent ??= record.Continent;
        qso.State ??= record.State;
        qso.CqZone ??= record.CqZone;
        qso.ItuZone ??= record.ItuZone;
        qso.Iota ??= record.Iota;
    }

    public static bool MarkNotFound(QsoEntry qso, DateTime nowUtc)
    {
        if (qso.LotwConfirmedAt.HasValue) return false;

        qso.LotwLastResult = "LoTW status opdateret: ikke fundet";
        qso.UpdatedAt = nowUtc;
        return true;
    }

    internal static bool ShouldMarkNotFound(DateTime? previousLastSyncedAt, bool isFullReport)
    {
        return isFullReport || previousLastSyncedAt == null;
    }

    internal static bool IsLotwMatch(QsoEntry qso, string userId, LotwQslRecord record, Band band, Mode mode)
    {
        return QsoIdentity.IsDuplicateCandidate(
            qso,
            userId,
            qso.OwnCallsign,
            record.Call,
            record.TimeOn,
            band,
            mode,
            TimeSpan.FromSeconds(60),
            allowLocalTimeOffset: true);
    }
}
