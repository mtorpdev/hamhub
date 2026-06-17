using System.Collections.Concurrent;

namespace HamHub.Api.Services;

public record WsjtxAgentPresenceDto(bool Connected, DateTime? LastSeenAtUtc);

public class WsjtxAgentPresenceCache
{
    private readonly ConcurrentDictionary<string, DateTime> _lastSeenByUser = new();

    public void Touch(string userId, DateTime? seenAtUtc = null)
    {
        if (string.IsNullOrWhiteSpace(userId)) return;
        _lastSeenByUser[userId] = seenAtUtc ?? DateTime.UtcNow;
    }

    public WsjtxAgentPresenceDto GetStatus(string userId, DateTime? nowUtc = null, TimeSpan? freshness = null)
    {
        if (string.IsNullOrWhiteSpace(userId) || !_lastSeenByUser.TryGetValue(userId, out var lastSeenAtUtc))
            return new WsjtxAgentPresenceDto(false, null);

        var now = nowUtc ?? DateTime.UtcNow;
        var window = freshness ?? TimeSpan.FromSeconds(15);
        return new WsjtxAgentPresenceDto(now - lastSeenAtUtc <= window, lastSeenAtUtc);
    }
}
