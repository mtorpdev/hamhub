using System.Globalization;
using System.Text.Json;
using Microsoft.AspNetCore.WebUtilities;

namespace HamHub.Api.Services;

public class OpenMeteoWeatherService
{
    private readonly HttpClient _httpClient;

    public OpenMeteoWeatherService(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<QsoWeatherDto?> GetHistoricalWeatherAsync(
        double latitude,
        double longitude,
        DateTime nearestHourUtc,
        CancellationToken ct)
    {
        var date = nearestHourUtc.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var query = new Dictionary<string, string?>
        {
            ["latitude"] = latitude.ToString(CultureInfo.InvariantCulture),
            ["longitude"] = longitude.ToString(CultureInfo.InvariantCulture),
            ["start_date"] = date,
            ["end_date"] = date,
            ["hourly"] = "temperature_2m,relative_humidity_2m,precipitation,pressure_msl,cloud_cover,wind_speed_10m,wind_direction_10m",
            ["timezone"] = "UTC"
        };

        var uri = QueryHelpers.AddQueryString("https://archive-api.open-meteo.com/v1/archive", query);
        using var response = await _httpClient.GetAsync(uri, ct);
        if (!response.IsSuccessStatusCode) return null;

        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        using var document = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
        if (!document.RootElement.TryGetProperty("hourly", out var hourly)) return null;
        if (!TryGetArray(hourly, "time", out var times)) return null;

        var targetText = nearestHourUtc.ToString("yyyy-MM-dd'T'HH:mm", CultureInfo.InvariantCulture);
        var index = -1;
        for (var i = 0; i < times.GetArrayLength(); i++)
        {
            if (times[i].GetString() == targetText)
            {
                index = i;
                break;
            }
        }

        if (index < 0) return null;

        return new QsoWeatherDto(
            TimeUtc: nearestHourUtc,
            TemperatureC: GetDoubleAt(hourly, "temperature_2m", index),
            RelativeHumidityPercent: GetDoubleAt(hourly, "relative_humidity_2m", index),
            PressureHpa: GetDoubleAt(hourly, "pressure_msl", index),
            CloudCoverPercent: GetDoubleAt(hourly, "cloud_cover", index),
            WindSpeedKmh: GetDoubleAt(hourly, "wind_speed_10m", index),
            WindDirectionDegrees: GetDoubleAt(hourly, "wind_direction_10m", index),
            PrecipitationMm: GetDoubleAt(hourly, "precipitation", index));
    }

    private static bool TryGetArray(JsonElement parent, string name, out JsonElement array)
    {
        array = default;
        return parent.TryGetProperty(name, out array) && array.ValueKind == JsonValueKind.Array;
    }

    private static double? GetDoubleAt(JsonElement hourly, string name, int index)
    {
        if (!TryGetArray(hourly, name, out var array)) return null;
        if (index >= array.GetArrayLength()) return null;
        var value = array[index];
        return value.ValueKind == JsonValueKind.Number ? value.GetDouble() : null;
    }
}
