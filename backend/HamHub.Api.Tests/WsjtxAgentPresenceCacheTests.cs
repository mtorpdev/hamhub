using HamHub.Api.Services;
using Xunit;

namespace HamHub.Api.Tests;

public class WsjtxAgentPresenceCacheTests
{
    [Fact]
    public void TouchMarksAgentActiveWithinFreshnessWindow()
    {
        var cache = new WsjtxAgentPresenceCache();
        var now = new DateTime(2026, 6, 17, 5, 45, 0, DateTimeKind.Utc);

        cache.Touch("user-1", now.AddSeconds(-5));

        var status = cache.GetStatus("user-1", now, TimeSpan.FromSeconds(30));

        Assert.True(status.Connected);
        Assert.Equal(now.AddSeconds(-5), status.LastSeenAtUtc);
    }

    [Fact]
    public void GetStatusMarksAgentInactiveWhenLastPollIsStale()
    {
        var cache = new WsjtxAgentPresenceCache();
        var now = new DateTime(2026, 6, 17, 5, 45, 0, DateTimeKind.Utc);

        cache.Touch("user-1", now.AddSeconds(-45));

        var status = cache.GetStatus("user-1", now, TimeSpan.FromSeconds(30));

        Assert.False(status.Connected);
        Assert.Equal(now.AddSeconds(-45), status.LastSeenAtUtc);
    }
}
