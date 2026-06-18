using HamHub.Api.Services;
using HamHub.Domain.Entities;
using HamHub.Domain.Enums;
using HamHub.Infrastructure.Services;
using Xunit;

namespace HamHub.Api.Tests;

public class QrzReconciliationServiceTests
{
    [Fact]
    public void BuildSeparatesMatchedTimeDriftLocalOnlyAndQrzOnlyItems()
    {
        var local = new[]
        {
            Qso(1, "K1ABC", new DateTime(2026, 6, 17, 10, 0, 0, DateTimeKind.Utc), qrzId: "qrz-1"),
            Qso(2, "F5RRS", new DateTime(2026, 6, 17, 11, 0, 0, DateTimeKind.Utc), qrzId: "qrz-2"),
            Qso(3, "OZ1AAA", new DateTime(2026, 6, 17, 12, 0, 0, DateTimeKind.Utc)),
        };
        var qrz = new[]
        {
            Qrz("K1ABC", new DateTime(2026, 6, 17, 10, 0, 20, DateTimeKind.Utc), "qrz-1"),
            Qrz("F5RRS", new DateTime(2026, 6, 17, 13, 0, 0, DateTimeKind.Utc), "qrz-2"),
            Qrz("DL1AAA", new DateTime(2026, 6, 17, 14, 0, 0, DateTimeKind.Utc), "qrz-3"),
        };

        var result = QrzReconciliationService.Build("user-1", "OZ4MT", local, qrz);

        Assert.Equal(3, result.HamHubCount);
        Assert.Equal(3, result.QrzCount);
        Assert.Equal(1, result.InSyncCount);
        Assert.Equal(1, result.TimeDriftCount);
        Assert.Equal(1, result.HamHubOnlyCount);
        Assert.Equal(1, result.QrzOnlyCount);
        Assert.Contains(result.Items, item => item.Status == QrzReconciliationStatus.InSync && item.WorkedCallsign == "K1ABC");
        Assert.Contains(result.Items, item => item.Status == QrzReconciliationStatus.TimeDrift && item.WorkedCallsign == "F5RRS" && item.TimeDeltaSeconds == 7200);
        Assert.Contains(result.Items, item => item.Status == QrzReconciliationStatus.HamHubOnly && item.WorkedCallsign == "OZ1AAA");
        Assert.Contains(result.Items, item => item.Status == QrzReconciliationStatus.QrzOnly && item.WorkedCallsign == "DL1AAA");

        var synced = Assert.Single(result.Items, item => item.Status == QrzReconciliationStatus.InSync);
        Assert.Equal(QrzReconciliationAction.None, synced.RecommendedAction);
        Assert.Equal("Ingen handling", synced.ActionLabel);

        var drift = Assert.Single(result.Items, item => item.Status == QrzReconciliationStatus.TimeDrift);
        Assert.Equal(QrzReconciliationAction.ReviewTime, drift.RecommendedAction);
        Assert.Equal("Ret tid", drift.ActionLabel);

        var hamHubOnly = Assert.Single(result.Items, item => item.Status == QrzReconciliationStatus.HamHubOnly);
        Assert.Equal(QrzReconciliationAction.UploadLocal, hamHubOnly.RecommendedAction);
        Assert.Equal("Send til QRZ", hamHubOnly.ActionLabel);

        var qrzOnly = Assert.Single(result.Items, item => item.Status == QrzReconciliationStatus.QrzOnly);
        Assert.Equal(QrzReconciliationAction.ImportFromQrz, qrzOnly.RecommendedAction);
        Assert.Equal("Importér", qrzOnly.ActionLabel);
    }

    [Fact]
    public void BuildReportsDuplicateQrzGroups()
    {
        var qrz = new[]
        {
            Qrz("K1ABC", new DateTime(2026, 6, 17, 10, 0, 0, DateTimeKind.Utc), "qrz-1"),
            Qrz("K1ABC", new DateTime(2026, 6, 17, 12, 0, 0, DateTimeKind.Utc), "qrz-2"),
        };

        var result = QrzReconciliationService.Build("user-1", "OZ4MT", Array.Empty<QsoEntry>(), qrz);

        var group = Assert.Single(result.QrzDuplicateGroups);
        Assert.Equal("K1ABC", group.WorkedCallsign);
        Assert.Equal(new[] { "qrz-2", "qrz-1" }, group.QrzLogIds);
    }

    [Fact]
    public void TryFindDuplicateDeleteCandidateOnlyAllowsLogIdsInDuplicateGroups()
    {
        var qrz = new[]
        {
            Qrz("K1ABC", new DateTime(2026, 6, 17, 10, 0, 0, DateTimeKind.Utc), "qrz-1"),
            Qrz("K1ABC", new DateTime(2026, 6, 17, 12, 0, 0, DateTimeKind.Utc), "qrz-2"),
            Qrz("DL1AAA", new DateTime(2026, 6, 17, 14, 0, 0, DateTimeKind.Utc), "qrz-3"),
        };

        var allowed = QrzReconciliationService.TryFindDuplicateDeleteCandidate(qrz, "qrz-2", out var candidate);
        var denied = QrzReconciliationService.TryFindDuplicateDeleteCandidate(qrz, "qrz-3", out var deniedCandidate);

        Assert.True(allowed);
        Assert.NotNull(candidate);
        Assert.Equal("K1ABC", candidate.WorkedCallsign);
        Assert.Equal("qrz-2", candidate.QrzLogId);
        Assert.Equal(new[] { "qrz-2", "qrz-1" }, candidate.GroupQrzLogIds);
        Assert.False(denied);
        Assert.Null(deniedCandidate);
    }

    private static QsoEntry Qso(int id, string call, DateTime dateUtc, string? qrzId = null) => new()
    {
        Id = id,
        UserId = "user-1",
        OwnCallsign = "OZ4MT",
        WorkedCallsign = call,
        DateUtc = dateUtc,
        Band = Band.M20,
        Mode = Mode.FT8,
        QrzId = qrzId
    };

    private static AdifQso Qrz(string call, DateTime timeOn, string logId) => new(
        Call: call,
        TimeOn: timeOn,
        Band: "20M",
        Mode: "FT8",
        RstSent: null,
        RstReceived: null,
        Submode: null,
        Gridsquare: null,
        MyGridsquare: null,
        Country: null,
        Dxcc: null,
        Continent: null,
        State: null,
        County: null,
        Iota: null,
        PotaRefs: null,
        SotaRefs: null,
        AwardRefs: null,
        Name: null,
        Qth: null,
        TxPower: null,
        Comment: null,
        LogId: logId,
        QrzStatus: null,
        QrzQslDate: null);
}
