using HamHub.Api.Services;
using HamHub.WsjtxCore.Models;
using Xunit;

namespace HamHub.Api.Tests;

public class WsjtxStatusCacheTests
{
    [Fact]
    public void UpdateStoresServerReceivedTimeWithoutChangingAgentObservedTime()
    {
        var cache = new WsjtxStatusCache();
        var agentObservedAt = new DateTime(2026, 6, 17, 5, 50, 0, DateTimeKind.Utc);
        var serverReceivedAt = agentObservedAt.AddSeconds(3);
        var status = new WsjtxStatusDto(
            WsjtxId: "WSJT-X",
            DxCall: "OZ1ABC",
            DxGrid: "JO55",
            Mode: "FT8",
            TxEnabled: true,
            Transmitting: false,
            Decoding: true,
            TxWatchdog: false,
            RxDf: 1_500,
            TxDf: 1_500,
            UpdatedAtUtc: agentObservedAt);

        cache.Update("user-1", status, serverReceivedAt);

        var latest = cache.GetLatest("user-1");
        Assert.NotNull(latest);
        Assert.Equal(agentObservedAt, latest.UpdatedAtUtc);
        Assert.Equal(serverReceivedAt, latest.ServerReceivedAtUtc);
    }
}
