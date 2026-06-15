using System.Net.Sockets;
using System.Text;
using Microsoft.Extensions.Caching.Memory;

namespace HamHub.Api.Services;

public sealed class DxClusterSpotService
{
    private const string CacheKey = "dx-cluster-spots";
    private readonly IConfiguration _configuration;
    private readonly IMemoryCache _cache;
    private readonly ILogger<DxClusterSpotService> _logger;

    public DxClusterSpotService(IConfiguration configuration, IMemoryCache cache, ILogger<DxClusterSpotService> logger)
    {
        _configuration = configuration;
        _cache = cache;
        _logger = logger;
    }

    public async Task<IReadOnlyList<DxClusterSpot>> GetSpotsAsync(int limit, CancellationToken ct)
    {
        limit = Math.Clamp(limit, 1, 200);
        if (_cache.TryGetValue(CacheKey, out IReadOnlyList<DxClusterSpot>? cached) && cached is { Count: > 0 })
            return cached.Take(limit).ToList();

        var loginCall = _configuration["DxCluster:LoginCall"] ?? "OZ1ADM";
        var sources = GetSources();
        using var fetchCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        fetchCts.CancelAfter(TimeSpan.FromSeconds(6));

        var fetches = sources
            .Select(source => FetchFromSourceSafelyAsync(source, loginCall, limit, fetchCts.Token))
            .ToArray();

        var results = await Task.WhenAll(fetches);
        var spots = results
            .SelectMany(result => result)
            .OrderByDescending(spot => spot.RetrievedAt)
            .Take(limit)
            .ToList();

        if (spots.Count > 0)
        {
            _cache.Set(CacheKey, spots, TimeSpan.FromSeconds(45));
            return spots;
        }

        return Array.Empty<DxClusterSpot>();
    }

    private IReadOnlyList<DxClusterSource> GetSources()
    {
        var configured = _configuration.GetSection("DxCluster:Sources").Get<DxClusterSource[]>();
        if (configured is { Length: > 0 }) return configured;

        return new[]
        {
            new DxClusterSource("OZ5BBS-7", "oz5bbs.dk", 8000),
            new DxClusterSource("G6NHU-2", "dxspider.co.uk", 7300),
            new DxClusterSource("NC7J", "dxc.nc7j.com", 7373),
        };
    }

    private async Task<IReadOnlyList<DxClusterSpot>> FetchFromSourceSafelyAsync(DxClusterSource source, string loginCall, int limit, CancellationToken ct)
    {
        try
        {
            return await FetchFromSourceAsync(source, loginCall, limit, ct);
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("DX cluster source {Name} timed out", source.Name);
            return Array.Empty<DxClusterSpot>();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "DX cluster source {Name} failed", source.Name);
            return Array.Empty<DxClusterSpot>();
        }
    }

    private static async Task<IReadOnlyList<DxClusterSpot>> FetchFromSourceAsync(DxClusterSource source, string loginCall, int limit, CancellationToken ct)
    {
        using var client = new TcpClient();
        await client.ConnectAsync(source.Host, source.Port, ct).AsTask().WaitAsync(TimeSpan.FromSeconds(3), ct);

        await using var stream = client.GetStream();
        using var reader = new StreamReader(stream, Encoding.Latin1, leaveOpen: true);
        await using var writer = new StreamWriter(stream, Encoding.ASCII, leaveOpen: true)
        {
            AutoFlush = true,
            NewLine = "\r\n"
        };

        await writer.WriteLineAsync(loginCall.AsMemory(), ct);
        await Task.Delay(250, ct);
        await writer.WriteLineAsync($"sh/dx {Math.Min(limit, 100)}".AsMemory(), ct);

        var spots = new List<DxClusterSpot>();
        var deadline = DateTimeOffset.UtcNow.AddSeconds(4);
        while (DateTimeOffset.UtcNow < deadline && spots.Count < limit)
        {
            var remaining = deadline - DateTimeOffset.UtcNow;
            if (remaining <= TimeSpan.Zero) break;

            string? line;
            try
            {
                line = await reader.ReadLineAsync(ct).AsTask().WaitAsync(remaining, ct);
            }
            catch (TimeoutException)
            {
                break;
            }

            if (line is null) break;
            var parsed = DxClusterSpotParser.TryParse(line, source.Name);
            if (parsed is not null) spots.Add(parsed);
        }

        return spots;
    }
}

public sealed record DxClusterSource(string Name, string Host, int Port);
