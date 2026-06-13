using System.Collections.Concurrent;

namespace HamHub.WsjtxCore;

public class StatusEntry
{
    public string DeCall { get; set; } = string.Empty;
    public ulong DialFreqHz { get; set; }
    public string Mode { get; set; } = string.Empty;
}

public class StatusCache
{
    private readonly ConcurrentDictionary<string, StatusEntry> _cache = new();

    public void Update(string id, StatusEntry entry) => _cache[id] = entry;

    public StatusEntry Get(string id) =>
        _cache.TryGetValue(id, out var entry) ? entry : new StatusEntry();
}
