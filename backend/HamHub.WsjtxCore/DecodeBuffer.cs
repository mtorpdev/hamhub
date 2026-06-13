using System.Collections.Concurrent;
using HamHub.WsjtxCore.Models;
using Microsoft.Extensions.Logging;

namespace HamHub.WsjtxCore;

public class DecodeBuffer : IDisposable
{
    private readonly ConcurrentQueue<WsjtxDecodeDto> _queue = new();
    private readonly HamHubApiClient _api;
    private readonly ILogger<DecodeBuffer> _logger;
    private PeriodicTimer? _timer;
    private Task? _drainTask;

    public DecodeBuffer(HamHubApiClient api, ILogger<DecodeBuffer> logger)
    {
        _api = api;
        _logger = logger;
    }

    public void Enqueue(WsjtxDecodeDto decode) => _queue.Enqueue(decode);

    public void Start(CancellationToken ct)
    {
        _timer = new PeriodicTimer(TimeSpan.FromSeconds(15));
        _drainTask = DrainLoopAsync(ct);
    }

    private async Task DrainLoopAsync(CancellationToken ct)
    {
        while (await _timer!.WaitForNextTickAsync(ct))
        {
            var batch = new List<WsjtxDecodeDto>();
            while (_queue.TryDequeue(out var item))
                batch.Add(item);

            if (batch.Count == 0) continue;

            try
            {
                await _api.PostDecodesAsync(batch.ToArray(), ct);
                _logger.LogDebug("Flushed {Count} decodes to HamHub", batch.Count);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Failed to flush {Count} decodes", batch.Count);
            }
        }
    }

    public void Dispose()
    {
        _timer?.Dispose();
    }
}
