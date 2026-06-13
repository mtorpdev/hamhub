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
    private CancellationTokenSource? _cts;
    private Task? _drainTask;

    public DecodeBuffer(HamHubApiClient api, ILogger<DecodeBuffer> logger)
    {
        _api = api;
        _logger = logger;
    }

    public void Enqueue(WsjtxDecodeDto decode) => _queue.Enqueue(decode);

    public void Start(CancellationToken externalCt)
    {
        _cts = CancellationTokenSource.CreateLinkedTokenSource(externalCt);
        _timer = new PeriodicTimer(TimeSpan.FromSeconds(15));
        _drainTask = DrainLoopAsync(_cts.Token);
    }

    private async Task DrainLoopAsync(CancellationToken ct)
    {
        try
        {
            while (await _timer!.WaitForNextTickAsync(ct))
                await FlushAsync(ct);
        }
        catch (OperationCanceledException) { }

        // Final flush on shutdown — best-effort
        try { await FlushAsync(CancellationToken.None); }
        catch (Exception ex) { _logger.LogError(ex, "Final flush failed"); }
    }

    private async Task FlushAsync(CancellationToken ct)
    {
        var batch = new List<WsjtxDecodeDto>();
        while (_queue.TryDequeue(out var item))
            batch.Add(item);

        if (batch.Count == 0) return;

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

    public void Dispose()
    {
        _cts?.Cancel();
        if (_drainTask != null)
        {
            try
            {
                bool completed = _drainTask.Wait(TimeSpan.FromSeconds(5));
                if (!completed)
                    _logger.LogWarning("DecodeBuffer drain task did not complete within 5 s timeout; final batch may not have been flushed");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Drain task did not complete within timeout");
            }
        }
        // Dispose timer only after drain task finishes (or times out); drain task does not use _timer after CTS is cancelled
        _timer?.Dispose();
        _cts?.Dispose();
    }
}
