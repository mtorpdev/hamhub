using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Caching.Memory;

namespace HamHub.Api.Services;

public sealed class PotaClient
{
    private const string ActiveSpotsCacheKey = "pota-active-spots";
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly HttpClient _httpClient;
    private readonly IMemoryCache _cache;
    private readonly ILogger<PotaClient> _logger;

    public PotaClient(HttpClient httpClient, IMemoryCache cache, ILogger<PotaClient> logger)
    {
        _httpClient = httpClient;
        _cache = cache;
        _logger = logger;
    }

    public async Task<IReadOnlyList<PotaSpotDto>> GetActiveSpotsAsync(CancellationToken ct = default)
    {
        if (_cache.TryGetValue(ActiveSpotsCacheKey, out IReadOnlyList<PotaSpotDto>? cached) && cached is { Count: > 0 })
            return cached;

        try
        {
            using var response = await _httpClient.GetAsync("https://api.pota.app/spot/activator", ct);
            response.EnsureSuccessStatusCode();
            await using var stream = await response.Content.ReadAsStreamAsync(ct);
            var raw = await JsonSerializer.DeserializeAsync<PotaSpotResponse[]>(stream, JsonOptions, ct) ?? [];
            var spots = raw
                .Select(MapSpot)
                .Where(spot => !string.IsNullOrWhiteSpace(spot.Activator) && !string.IsNullOrWhiteSpace(spot.Reference))
                .OrderByDescending(spot => spot.SpotTimeUtc)
                .ToArray();

            _cache.Set(ActiveSpotsCacheKey, spots, TimeSpan.FromSeconds(45));
            return spots;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "POTA spot feed could not be fetched");
            return Array.Empty<PotaSpotDto>();
        }
    }

    private static PotaSpotDto MapSpot(PotaSpotResponse spot)
    {
        var frequencyKhz = ParseFrequencyKhz(spot.Frequency);
        return new PotaSpotDto(
            SpotId: spot.SpotId,
            Activator: spot.Activator?.Trim().ToUpperInvariant() ?? "",
            Frequency: spot.Frequency?.Trim() ?? "",
            FrequencyKhz: frequencyKhz,
            Band: BandFromFrequencyKhz(frequencyKhz),
            Mode: spot.Mode?.Trim().ToUpperInvariant() ?? "",
            Reference: spot.Reference?.Trim().ToUpperInvariant() ?? "",
            ParkName: FirstNonBlank(spot.Name, spot.ParkName),
            LocationDesc: spot.LocationDesc,
            Grid4: spot.Grid4,
            Grid6: spot.Grid6,
            Latitude: spot.Latitude,
            Longitude: spot.Longitude,
            Spotter: spot.Spotter,
            Comments: spot.Comments,
            Source: spot.Source,
            SpotTimeUtc: ParseUtc(spot.SpotTime),
            ExpiresInSeconds: spot.Expire);
    }

    private static int? ParseFrequencyKhz(string? frequency)
    {
        if (string.IsNullOrWhiteSpace(frequency)) return null;
        return double.TryParse(frequency, NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed)
            ? (int)Math.Round(parsed)
            : null;
    }

    private static DateTime ParseUtc(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return DateTime.UtcNow;
        if (!DateTime.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var parsed))
            return DateTime.UtcNow;
        return DateTime.SpecifyKind(parsed, DateTimeKind.Utc);
    }

    private static string? FirstNonBlank(params string?[] values) =>
        values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value))?.Trim();

    private static string? BandFromFrequencyKhz(int? khz) => khz switch
    {
        >= 1800 and <= 2000 => "160m",
        >= 3500 and <= 4000 => "80m",
        >= 5330 and <= 5410 => "60m",
        >= 7000 and <= 7300 => "40m",
        >= 10100 and <= 10150 => "30m",
        >= 14000 and <= 14350 => "20m",
        >= 18068 and <= 18168 => "17m",
        >= 21000 and <= 21450 => "15m",
        >= 24890 and <= 24990 => "12m",
        >= 28000 and <= 29700 => "10m",
        >= 50000 and <= 54000 => "6m",
        >= 144000 and <= 148000 => "2m",
        >= 430000 and <= 440000 => "70cm",
        _ => null
    };

    private sealed record PotaSpotResponse(
        [property: JsonPropertyName("spotId")] long SpotId,
        [property: JsonPropertyName("activator")] string? Activator,
        [property: JsonPropertyName("frequency")] string? Frequency,
        [property: JsonPropertyName("mode")] string? Mode,
        [property: JsonPropertyName("reference")] string? Reference,
        [property: JsonPropertyName("parkName")] string? ParkName,
        [property: JsonPropertyName("name")] string? Name,
        [property: JsonPropertyName("locationDesc")] string? LocationDesc,
        [property: JsonPropertyName("grid4")] string? Grid4,
        [property: JsonPropertyName("grid6")] string? Grid6,
        [property: JsonPropertyName("latitude")] double? Latitude,
        [property: JsonPropertyName("longitude")] double? Longitude,
        [property: JsonPropertyName("spotter")] string? Spotter,
        [property: JsonPropertyName("comments")] string? Comments,
        [property: JsonPropertyName("source")] string? Source,
        [property: JsonPropertyName("spotTime")] string? SpotTime,
        [property: JsonPropertyName("expire")] int? Expire);
}

public sealed record PotaSpotDto(
    long SpotId,
    string Activator,
    string Frequency,
    int? FrequencyKhz,
    string? Band,
    string Mode,
    string Reference,
    string? ParkName,
    string? LocationDesc,
    string? Grid4,
    string? Grid6,
    double? Latitude,
    double? Longitude,
    string? Spotter,
    string? Comments,
    string? Source,
    DateTime SpotTimeUtc,
    int? ExpiresInSeconds);
