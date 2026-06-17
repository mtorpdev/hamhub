using HamHub.Domain.Entities;
using HamHub.Domain.Enums;
using HamHub.Infrastructure.Persistence;
using HamHub.Infrastructure.Services;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;

namespace HamHub.Api.Services;

public class QrzSyncService : BackgroundService
{
    private readonly IQrzSyncTrigger _trigger;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IDataProtector _protector;
    private readonly ILogger<QrzSyncService> _logger;

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
    private static readonly Dictionary<Band, string> BandAdif = new()
    {
        [Band.M160] = "160M", [Band.M80] = "80M", [Band.M60] = "60M", [Band.M40] = "40M",
        [Band.M30] = "30M", [Band.M20] = "20M", [Band.M17] = "17M", [Band.M15] = "15M",
        [Band.M12] = "12M", [Band.M10] = "10M", [Band.M6] = "6M", [Band.M2] = "2M",
        [Band.CM70] = "70CM"
    };
    private static readonly Dictionary<Mode, string> ModeAdif = new()
    {
        [Mode.SSB] = "SSB", [Mode.CW] = "CW", [Mode.FT8] = "FT8", [Mode.FT4] = "FT4",
        [Mode.RTTY] = "RTTY", [Mode.DMR] = "DMR", [Mode.FM] = "FM", [Mode.AM] = "AM"
    };

    public QrzSyncService(
        IQrzSyncTrigger trigger,
        IServiceScopeFactory scopeFactory,
        IDataProtectionProvider dataProtectionProvider,
        ILogger<QrzSyncService> logger)
    {
        _trigger = trigger;
        _scopeFactory = scopeFactory;
        _protector = dataProtectionProvider.CreateProtector("QrzApiKey");
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Event loop: immediately sync when notified of a new/updated QSO
        _ = Task.Run(async () =>
        {
            await foreach (var userId in _trigger.ReadAsync(stoppingToken))
                await SyncUserAsync(userId, stoppingToken);
        }, CancellationToken.None);

        // Periodic loop: full sync every 15 minutes
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(15));
        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
                await RunPeriodicSyncAsync(stoppingToken);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
    }

    private async Task RunPeriodicSyncAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var userIds = await db.Users
            .Where(u => u.QrzApiKey != null)
            .Select(u => u.Id)
            .ToListAsync(ct);

        foreach (var userId in userIds)
            await SyncUserAsync(userId, ct);
    }

    private async Task SyncUserAsync(string userId, CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var qrzClient = scope.ServiceProvider.GetRequiredService<QrzClient>();

        var user = await db.Users.FindAsync([userId], ct);
        if (user?.QrzApiKey == null) return;

        string apiKey;
        try { apiKey = _protector.Unprotect(user.QrzApiKey); }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to decrypt QRZ API key for user {UserId}", userId);
            return;
        }

        try
        {
            var qrzQsos = await qrzClient.FetchLogAsync(apiKey, ct);

            foreach (var qrzQso in qrzQsos)
            {
                if (!BandMap.TryGetValue(qrzQso.Band, out var band)) continue;
                if (!ModeMap.TryGetValue(qrzQso.Mode, out var mode)) continue;

                var lower = qrzQso.TimeOn.AddHours(-2).AddSeconds(-60);
                var upper = qrzQso.TimeOn.AddHours(2).AddSeconds(60);

                var candidates = await db.QsoEntries
                    .Where(q =>
                        q.UserId == userId &&
                        q.WorkedCallsign == qrzQso.Call &&
                        q.DateUtc >= lower && q.DateUtc <= upper &&
                        q.Mode == mode)
                    .OrderByDescending(q => q.UpdatedAt)
                    .ToListAsync(ct);

                var match = candidates.FirstOrDefault(q => QsoIdentity.IsDuplicateCandidate(
                    q,
                    userId,
                    user.Callsign ?? string.Empty,
                    qrzQso.Call,
                    qrzQso.TimeOn,
                    band,
                    mode,
                    TimeSpan.FromSeconds(60),
                    allowLocalTimeOffset: true));

                if (match == null)
                {
                    // New record from QRZ — import it
                    db.QsoEntries.Add(new QsoEntry
                    {
                        UserId = userId,
                        WorkedCallsign = qrzQso.Call,
                        OwnCallsign = user.Callsign ?? string.Empty,
                        DateUtc = qrzQso.TimeOn,
                        Band = band,
                        Mode = mode,
                        RstSent = qrzQso.RstSent,
                        RstReceived = qrzQso.RstReceived,
                        Submode = qrzQso.Submode,
                        Locator = qrzQso.Gridsquare,
                        MyGridsquare = qrzQso.MyGridsquare,
                        Country = qrzQso.Country,
                        Dxcc = qrzQso.Dxcc,
                        Continent = qrzQso.Continent,
                        State = qrzQso.State,
                        County = qrzQso.County,
                        Iota = qrzQso.Iota,
                        PotaRefs = qrzQso.PotaRefs,
                        SotaRefs = qrzQso.SotaRefs,
                        AwardRefs = qrzQso.AwardRefs,
                        Name = qrzQso.Name,
                        Qth = qrzQso.Qth,
                        TxPower = qrzQso.TxPower,
                        Comment = qrzQso.Comment,
                        QrzId = qrzQso.LogId,
                        QrzConfirmationStatus = qrzQso.QrzStatus,
                        QrzQslDate = qrzQso.QrzQslDate,
                        QrzConfirmedAt = IsQrzConfirmed(qrzQso.QrzStatus) ? qrzQso.QrzQslDate ?? DateTime.UtcNow : null,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    });
                }
                else if (match.QrzId == null)
                {
                    // Match found, not yet linked. QRZ already has this QSO, so link it
                    // instead of inserting another QRZ record and echoing back a duplicate.
                    if (ShouldUploadMatchedLocalQso(match))
                    {
                        // Reserved for a future explicit "replace QRZ record" flow.
                        try
                        {
                            var adifQso = new AdifQso(
                                Call: match.WorkedCallsign,
                                TimeOn: match.DateUtc,
                                Band: BandAdif.GetValueOrDefault(match.Band, "20M"),
                                Mode: ModeAdif.GetValueOrDefault(match.Mode, "SSB"),
                                RstSent: match.RstSent,
                                RstReceived: match.RstReceived,
                                Submode: match.Submode,
                                Gridsquare: match.Locator,
                                MyGridsquare: match.MyGridsquare,
                                Country: match.Country,
                                Dxcc: match.Dxcc,
                                Continent: match.Continent,
                                State: match.State,
                                County: match.County,
                                Iota: match.Iota,
                                PotaRefs: match.PotaRefs,
                                SotaRefs: match.SotaRefs,
                                AwardRefs: match.AwardRefs,
                                Name: match.Name,
                                Qth: match.Qth,
                                TxPower: match.TxPower,
                                Comment: match.Comment,
                                LogId: null,
                                QrzStatus: null,
                                QrzQslDate: null
                            );
                            match.QrzId = await qrzClient.UploadQsoAsync(adifQso, apiKey, ct);
                        }
                        catch (QrzApiException ex)
                        {
                            _logger.LogError(ex, "Failed to upload matched QSO {Id} to QRZ", match.Id);
                        }
                    }
                    else
                    {
                        // QRZ is authoritative — overwrite local fields and link
                        match.Band = band;
                        match.RstSent = qrzQso.RstSent ?? match.RstSent;
                        match.RstReceived = qrzQso.RstReceived ?? match.RstReceived;
                        match.Locator = qrzQso.Gridsquare ?? match.Locator;
                        ApplyFetchedQrzFields(match, qrzQso);
                        match.QrzId = qrzQso.LogId;
                    }
                    if (!Enum.IsDefined(match.Band) || (int)match.Band == 0)
                        match.Band = band;
                    ApplyQrzConfirmation(match, qrzQso);
                    match.UpdatedAt = DateTime.UtcNow;
                }
                else
                {
                    ApplyQrzConfirmation(match, qrzQso);
                    match.UpdatedAt = DateTime.UtcNow;
                }
            }

            // Upload any local QSOs that have never been synced to QRZ
            var unsynced = await db.QsoEntries
                .Where(q => q.UserId == userId && q.QrzId == null)
                .ToListAsync(ct);

            foreach (var qso in unsynced)
            {
                try
                {
                    var adifQso = new AdifQso(
                        Call: qso.WorkedCallsign,
                        TimeOn: qso.DateUtc,
                        Band: BandAdif.GetValueOrDefault(qso.Band, "20M"),
                        Mode: ModeAdif.GetValueOrDefault(qso.Mode, "SSB"),
                        RstSent: qso.RstSent,
                        RstReceived: qso.RstReceived,
                        Submode: qso.Submode,
                        Gridsquare: qso.Locator,
                        MyGridsquare: qso.MyGridsquare,
                        Country: qso.Country,
                        Dxcc: qso.Dxcc,
                        Continent: qso.Continent,
                        State: qso.State,
                        County: qso.County,
                        Iota: qso.Iota,
                        PotaRefs: qso.PotaRefs,
                        SotaRefs: qso.SotaRefs,
                        AwardRefs: qso.AwardRefs,
                        Name: qso.Name,
                        Qth: qso.Qth,
                        TxPower: qso.TxPower,
                        Comment: qso.Comment,
                        LogId: null,
                        QrzStatus: null,
                        QrzQslDate: null
                    );
                    qso.QrzId = await qrzClient.UploadQsoAsync(adifQso, apiKey, ct);
                    qso.UpdatedAt = DateTime.UtcNow;
                }
                catch (QrzApiException ex)
                {
                    _logger.LogError(ex, "Failed to upload QSO {Id} to QRZ for user {UserId}", qso.Id, userId);
                }
            }

            user.QrzLastSyncedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
        }
        catch (QrzApiException ex)
        {
            _logger.LogWarning(ex, "QRZ sync failed for user {UserId} — will retry next tick", userId);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error during QRZ sync for user {UserId}", userId);
        }
    }

    private static void ApplyQrzConfirmation(QsoEntry qso, AdifQso qrzQso)
    {
        qso.QrzConfirmationStatus = qrzQso.QrzStatus;
        qso.QrzQslDate = qrzQso.QrzQslDate;
        qso.QrzConfirmedAt = IsQrzConfirmed(qrzQso.QrzStatus)
            ? qrzQso.QrzQslDate ?? qso.QrzConfirmedAt ?? DateTime.UtcNow
            : null;
    }

    private static bool IsQrzConfirmed(string? status) =>
        string.Equals(status, "C", StringComparison.OrdinalIgnoreCase);

    internal static void ApplyFetchedQrzFields(QsoEntry qso, AdifQso qrzQso)
    {
        qso.Country ??= qrzQso.Country;
        qso.Dxcc ??= qrzQso.Dxcc;
        qso.Continent ??= qrzQso.Continent;
        qso.State ??= qrzQso.State;
        qso.County ??= qrzQso.County;
        qso.Iota ??= qrzQso.Iota;
        qso.PotaRefs ??= qrzQso.PotaRefs;
        qso.SotaRefs ??= qrzQso.SotaRefs;
        qso.AwardRefs ??= qrzQso.AwardRefs;
    }

    private static bool ShouldUploadMatchedLocalQso(QsoEntry qso)
    {
        // A QRZ fetch match means QRZ already has this QSO. Linking the fetched LOGID is
        // safer than inserting another QRZ record, which can echo back as a HamHub duplicate.
        return false;
    }
}
