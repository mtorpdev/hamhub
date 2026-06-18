using HamHub.Domain.Entities;
using HamHub.Domain.Enums;
using HamHub.Infrastructure.Services;
using System.Text.Json.Serialization;

namespace HamHub.Api.Services;

public static class QrzReconciliationService
{
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

    public static QrzReconciliationResponse Build(
        string userId,
        string ownCallsign,
        IReadOnlyCollection<QsoEntry> hamHubQsos,
        IReadOnlyCollection<AdifQso> qrzQsos)
    {
        var items = new List<QrzReconciliationItemDto>();
        var matchedLocalIds = new HashSet<int>();
        var matchedQrzKeys = new HashSet<string>();

        foreach (var qrz in qrzQsos)
        {
            if (!TryNormalize(qrz, out var band, out var mode)) continue;
            var qrzKey = QrzKey(qrz);
            var candidates = hamHubQsos
                .Where(local => !matchedLocalIds.Contains(local.Id))
                .Where(local => QsoIdentity.IsDuplicateCandidate(
                    local,
                    userId,
                    ownCallsign,
                    qrz.Call,
                    qrz.TimeOn,
                    band,
                    mode,
                    TimeSpan.FromSeconds(60),
                    allowLocalTimeOffset: true))
                .OrderBy(local => Math.Abs((local.DateUtc - qrz.TimeOn).TotalSeconds))
                .ThenBy(local => local.Id)
                .ToArray();

            var match = candidates.FirstOrDefault();
            if (match is null) continue;

            matchedLocalIds.Add(match.Id);
            matchedQrzKeys.Add(qrzKey);
            var delta = (int)Math.Round((qrz.TimeOn - match.DateUtc).TotalSeconds);
            var status = Math.Abs(delta) <= 60
                ? QrzReconciliationStatus.InSync
                : QrzReconciliationStatus.TimeDrift;
            items.Add(Item(status, match, qrz, band, mode, delta));
        }

        foreach (var local in hamHubQsos.Where(qso => !matchedLocalIds.Contains(qso.Id)))
        {
            items.Add(Item(QrzReconciliationStatus.HamHubOnly, local, null, local.Band, local.Mode, null));
        }

        foreach (var qrz in qrzQsos.Where(qrz => !matchedQrzKeys.Contains(QrzKey(qrz))))
        {
            if (!TryNormalize(qrz, out var band, out var mode)) continue;
            items.Add(Item(QrzReconciliationStatus.QrzOnly, null, qrz, band, mode, null));
        }

        var duplicateGroups = BuildQrzDuplicateGroups(qrzQsos);

        return new QrzReconciliationResponse(
            HamHubCount: hamHubQsos.Count,
            QrzCount: qrzQsos.Count,
            InSyncCount: items.Count(item => item.Status == QrzReconciliationStatus.InSync),
            TimeDriftCount: items.Count(item => item.Status == QrzReconciliationStatus.TimeDrift),
            HamHubOnlyCount: items.Count(item => item.Status == QrzReconciliationStatus.HamHubOnly),
            QrzOnlyCount: items.Count(item => item.Status == QrzReconciliationStatus.QrzOnly),
            QrzDuplicateGroupCount: duplicateGroups.Length,
            Items: items.OrderByDescending(item => item.HamHubDateUtc ?? item.QrzDateUtc).ToArray(),
            QrzDuplicateGroups: duplicateGroups);
    }

    private static QrzDuplicateGroupDto[] BuildQrzDuplicateGroups(IReadOnlyCollection<AdifQso> qrzQsos)
    {
        var groups = new List<QrzDuplicateGroupDto>();
        foreach (var bucket in qrzQsos
            .Where(qrz => TryNormalize(qrz, out _, out _))
            .GroupBy(qrz =>
            {
                TryNormalize(qrz, out var band, out var mode);
                return $"{qrz.Call.Trim().ToUpperInvariant()}|{band}|{mode}";
            }))
        {
            var ordered = bucket.OrderBy(qrz => qrz.TimeOn).ToArray();
            var used = new HashSet<string>();
            for (var i = 0; i < ordered.Length; i++)
            {
                if (used.Contains(QrzKey(ordered[i]))) continue;
                var duplicates = new List<AdifQso> { ordered[i] };
                for (var j = i + 1; j < ordered.Length; j++)
                {
                    if (TimesMatch(ordered[i].TimeOn, ordered[j].TimeOn))
                    {
                        duplicates.Add(ordered[j]);
                    }
                }

                if (duplicates.Count <= 1) continue;
                foreach (var duplicate in duplicates) used.Add(QrzKey(duplicate));
                TryNormalize(ordered[i], out var band, out var mode);
                groups.Add(new QrzDuplicateGroupDto(
                    WorkedCallsign: ordered[i].Call,
                    Band: BandToDisplay(band),
                    Mode: mode.ToString(),
                    QrzLogIds: duplicates.OrderByDescending(qrz => qrz.TimeOn).Select(qrz => qrz.LogId ?? "").ToArray(),
                    DatesUtc: duplicates.OrderByDescending(qrz => qrz.TimeOn).Select(qrz => qrz.TimeOn).ToArray()));
            }
        }

        return groups.OrderByDescending(group => group.DatesUtc.Max()).ToArray();
    }

    private static bool TimesMatch(DateTime left, DateTime right)
    {
        var delta = left - right;
        if (delta.Duration() <= TimeSpan.FromSeconds(60)) return true;
        return new[] { TimeSpan.FromHours(1), TimeSpan.FromHours(2) }.Any(offset =>
            (delta - offset).Duration() <= TimeSpan.FromSeconds(60) ||
            (delta + offset).Duration() <= TimeSpan.FromSeconds(60));
    }

    private static bool TryNormalize(AdifQso qrz, out Band band, out Mode mode)
    {
        var ok = BandMap.TryGetValue(qrz.Band, out band) & ModeMap.TryGetValue(qrz.Mode, out mode);
        return ok;
    }

    private static QrzReconciliationItemDto Item(
        QrzReconciliationStatus status,
        QsoEntry? local,
        AdifQso? qrz,
        Band band,
        Mode mode,
        int? deltaSeconds) => new(
            Status: status,
            WorkedCallsign: local?.WorkedCallsign ?? qrz?.Call ?? "",
            Band: BandToDisplay(band),
            Mode: mode.ToString(),
            HamHubQsoId: local?.Id,
            QrzLogId: qrz?.LogId,
            HamHubDateUtc: local?.DateUtc,
            QrzDateUtc: qrz?.TimeOn,
            TimeDeltaSeconds: deltaSeconds,
            Message: BuildMessage(status, deltaSeconds),
            RecommendedAction: BuildRecommendedAction(status),
            ActionLabel: BuildActionLabel(status),
            ActionDescription: BuildActionDescription(status));

    private static string BuildMessage(QrzReconciliationStatus status, int? deltaSeconds) => status switch
    {
        QrzReconciliationStatus.InSync => "HamHub og QRZ matcher.",
        QrzReconciliationStatus.TimeDrift => $"Matcher med tidsforskel på {deltaSeconds} sekunder.",
        QrzReconciliationStatus.HamHubOnly => "Findes kun i HamHub.",
        QrzReconciliationStatus.QrzOnly => "Findes kun i QRZ.",
        _ => status.ToString()
    };

    private static QrzReconciliationAction BuildRecommendedAction(QrzReconciliationStatus status) => status switch
    {
        QrzReconciliationStatus.HamHubOnly => QrzReconciliationAction.UploadLocal,
        QrzReconciliationStatus.QrzOnly => QrzReconciliationAction.ImportFromQrz,
        QrzReconciliationStatus.TimeDrift => QrzReconciliationAction.ReviewTime,
        _ => QrzReconciliationAction.None
    };

    private static string BuildActionLabel(QrzReconciliationStatus status) => status switch
    {
        QrzReconciliationStatus.HamHubOnly => "Send til QRZ",
        QrzReconciliationStatus.QrzOnly => "Importér",
        QrzReconciliationStatus.TimeDrift => "Ret tid",
        _ => "Ingen handling"
    };

    private static string BuildActionDescription(QrzReconciliationStatus status) => status switch
    {
        QrzReconciliationStatus.HamHubOnly => "Uploader denne konkrete HamHub QSO til QRZ, hvis den stadig mangler QRZ id.",
        QrzReconciliationStatus.QrzOnly => "Importerer denne konkrete QRZ QSO til HamHub, hvis den stadig ikke matcher en lokal QSO.",
        QrzReconciliationStatus.TimeDrift => "Saetter denne lokale QSO til QRZ UTC-tiden og linker QRZ LOGID efter manuel kontrol.",
        _ => "Ingen handling noedvendig."
    };

    private static string QrzKey(AdifQso qrz) =>
        !string.IsNullOrWhiteSpace(qrz.LogId)
            ? qrz.LogId
            : $"{qrz.Call}|{qrz.Band}|{qrz.Mode}|{qrz.TimeOn:O}";

    private static string BandToDisplay(Band band) => band switch
    {
        Band.M160 => "160m",
        Band.M80 => "80m",
        Band.M60 => "60m",
        Band.M40 => "40m",
        Band.M30 => "30m",
        Band.M20 => "20m",
        Band.M17 => "17m",
        Band.M15 => "15m",
        Band.M12 => "12m",
        Band.M10 => "10m",
        Band.M6 => "6m",
        Band.M2 => "2m",
        Band.CM70 => "70cm",
        _ => band.ToString()
    };
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum QrzReconciliationStatus
{
    InSync,
    TimeDrift,
    HamHubOnly,
    QrzOnly
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum QrzReconciliationAction
{
    None,
    RunSync,
    UploadLocal,
    ImportFromQrz,
    ReviewTime
}

public record QrzReconciliationResponse(
    int HamHubCount,
    int QrzCount,
    int InSyncCount,
    int TimeDriftCount,
    int HamHubOnlyCount,
    int QrzOnlyCount,
    int QrzDuplicateGroupCount,
    QrzReconciliationItemDto[] Items,
    QrzDuplicateGroupDto[] QrzDuplicateGroups);

public record QrzReconciliationItemDto(
    QrzReconciliationStatus Status,
    string WorkedCallsign,
    string Band,
    string Mode,
    int? HamHubQsoId,
    string? QrzLogId,
    DateTime? HamHubDateUtc,
    DateTime? QrzDateUtc,
    int? TimeDeltaSeconds,
    string Message,
    QrzReconciliationAction RecommendedAction,
    string ActionLabel,
    string ActionDescription);

public record QrzDuplicateGroupDto(
    string WorkedCallsign,
    string Band,
    string Mode,
    string[] QrzLogIds,
    DateTime[] DatesUtc);
