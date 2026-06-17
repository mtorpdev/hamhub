using System.Globalization;
using Microsoft.Extensions.Caching.Memory;

namespace HamHub.Infrastructure.Services;

public record LotwActivityDto(string Callsign, DateOnly LastUploadDate);

public class LotwActivityClient
{
    private const string CacheKey = "lotw-activity";
    private static readonly Uri ActivityUri = new("https://lotw.arrl.org/lotw-user-activity.csv");
    private readonly HttpClient _http;
    private readonly IMemoryCache _cache;

    public LotwActivityClient(HttpClient http, IMemoryCache cache)
    {
        _http = http;
        _cache = cache;
    }

    public async Task<IReadOnlyDictionary<string, DateOnly>> GetActivityAsync(CancellationToken ct)
    {
        if (_cache.TryGetValue(CacheKey, out IReadOnlyDictionary<string, DateOnly>? cached) && cached is not null)
            return cached;

        var csv = await _http.GetStringAsync(ActivityUri, ct);
        var activity = ParseActivityCsv(csv);
        _cache.Set(CacheKey, activity, TimeSpan.FromDays(7));
        return activity;
    }

    public static IReadOnlyDictionary<string, DateOnly> ParseActivityCsv(string csv)
    {
        var activity = new Dictionary<string, DateOnly>(StringComparer.OrdinalIgnoreCase);
        using var reader = new StringReader(csv);
        string? line;
        while ((line = reader.ReadLine()) is not null)
        {
            var commaIndex = line.IndexOf(',');
            if (commaIndex <= 0 || commaIndex + 11 > line.Length) continue;

            var callsign = line[..commaIndex].Trim().ToUpperInvariant();
            if (callsign is "" or "CALLSIGN") continue;

            var dateText = line.Substring(commaIndex + 1, 10);
            if (!DateOnly.TryParseExact(dateText, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var lastUploadDate))
                continue;

            activity[callsign] = lastUploadDate;
        }

        return activity;
    }
}
