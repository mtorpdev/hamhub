using System.Collections.Concurrent;

namespace HamHub.Api.Services;

public class CommunityPresenceTracker
{
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<string, byte>> _connectionsByUser = new();
    private readonly ConcurrentDictionary<string, string> _userByConnection = new();

    public IReadOnlyCollection<string> OnlineUserIds =>
        _connectionsByUser
            .Where(pair => !pair.Value.IsEmpty)
            .Select(pair => pair.Key)
            .ToArray();

    public void Connect(string userId, string connectionId)
    {
        if (string.IsNullOrWhiteSpace(userId) || string.IsNullOrWhiteSpace(connectionId)) return;

        var connections = _connectionsByUser.GetOrAdd(userId, _ => new ConcurrentDictionary<string, byte>());
        connections[connectionId] = 0;
        _userByConnection[connectionId] = userId;
    }

    public string? Disconnect(string connectionId)
    {
        if (string.IsNullOrWhiteSpace(connectionId)) return null;
        if (!_userByConnection.TryRemove(connectionId, out var userId)) return null;

        if (_connectionsByUser.TryGetValue(userId, out var connections))
        {
            connections.TryRemove(connectionId, out _);
            if (connections.IsEmpty) _connectionsByUser.TryRemove(userId, out _);
        }

        return userId;
    }
}
