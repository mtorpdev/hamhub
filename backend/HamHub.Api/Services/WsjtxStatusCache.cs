using System.Collections.Concurrent;
using HamHub.WsjtxCore.Models;

namespace HamHub.Api.Services;

public class WsjtxStatusCache
{
    private readonly ConcurrentDictionary<string, WsjtxStatusDto> _latestByUser = new();

    public void Update(string userId, WsjtxStatusDto status)
    {
        if (string.IsNullOrWhiteSpace(userId)) return;
        _latestByUser[userId] = status;
    }

    public WsjtxStatusDto? GetLatest(string userId) =>
        _latestByUser.TryGetValue(userId, out var status) ? status : null;
}
