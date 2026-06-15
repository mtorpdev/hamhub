using System.Collections.Concurrent;

namespace HamHub.WsjtxCore;

public class StatusEntry
{
    public string DeCall { get; set; } = string.Empty;
    public string DeGrid { get; set; } = string.Empty;
    public ulong DialFreqHz { get; set; }
    public string Mode { get; set; } = string.Empty;
    public bool TxEnabled { get; set; }
    public bool Transmitting { get; set; }
    public bool Decoding { get; set; }
    public int RxDf { get; set; }
    public int TxDf { get; set; }
    public string DxCall { get; set; } = string.Empty;
    public string DxGrid { get; set; } = string.Empty;
    public bool TxWatchdog { get; set; }
}

public class StatusCache
{
    private readonly ConcurrentDictionary<string, StatusEntry> _cache = new();
    private string? _lastId;

    public void Update(string id, StatusEntry entry)
    {
        _cache[id] = entry;
        _lastId = id;
    }

    public StatusEntry Get(string id) =>
        _cache.TryGetValue(id, out var entry) ? entry : new StatusEntry();

    public bool TryGetLatest(out string id, out StatusEntry entry)
    {
        id = _lastId ?? string.Empty;
        if (_lastId is null || !_cache.TryGetValue(_lastId, out entry!))
        {
            entry = new StatusEntry();
            return false;
        }
        return true;
    }
}
