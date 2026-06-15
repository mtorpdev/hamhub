using System.Globalization;
using System.Text.Json;

namespace HamHub.Api.Services;

public class Kc2gMufFof2Service
{
    private readonly HttpClient _httpClient;

    public Kc2gMufFof2Service(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<QsoMufFof2Dto> GetSnapshotAsync(
        QsoLocationConditionsDto? own,
        QsoLocationConditionsDto? worked,
        CancellationToken ct)
    {
        if (own is null && worked is null) return Unavailable("Mangler grid locators til MUF/foF2 opslag.");

        try
        {
            var json = await _httpClient.GetStringAsync("https://prop.kc2g.com/api/stations.json", ct);
            return BuildSnapshot(json, own, worked);
        }
        catch
        {
            return Unavailable("KC2G MUF/foF2 data kunne ikke hentes lige nu.");
        }
    }

    public static QsoMufFof2Dto BuildSnapshot(
        string stationsJson,
        QsoLocationConditionsDto? own,
        QsoLocationConditionsDto? worked)
    {
        var stations = ParseStations(stationsJson);
        var midpoint = own is not null && worked is not null
            ? new GeoPoint((own.Latitude + worked.Latitude) / 2.0, NormalizeLongitude((own.Longitude + worked.Longitude) / 2.0))
            : null;
        var ownNearest = own is null ? null : FindNearest(stations, new GeoPoint(own.Latitude, own.Longitude));
        var workedNearest = worked is null ? null : FindNearest(stations, new GeoPoint(worked.Latitude, worked.Longitude));
        var midpointNearest = midpoint is null ? null : FindNearest(stations, midpoint);
        var referenceMuf = midpointNearest?.Muf3000Mhz ?? ownNearest?.Muf3000Mhz ?? workedNearest?.Muf3000Mhz;

        return new QsoMufFof2Dto(
            Status: stations.Count == 0 ? "Ingen stationer" : "Live nowcast",
            Source: "KC2G MUF/foF2 nowcast",
            SourceUrl: "https://prop.kc2g.com/",
            RetrievedAtUtc: DateTime.UtcNow,
            OwnNearestStation: ownNearest,
            WorkedNearestStation: workedNearest,
            MidpointNearestStation: midpointNearest,
            BandRecommendations: BuildBandRecommendations(referenceMuf),
            Description: "KC2G nowcast baseret på real-time ionosonde-data fra GIRO/INGV. Viser aktuelle MUF/foF2-forhold, ikke historiske forhold ved QSO-tidspunktet.");
    }

    public static QsoMufFof2Dto Unavailable(string description) => new(
        Status: "Ikke tilgængelig",
        Source: "KC2G MUF/foF2 nowcast",
        SourceUrl: "https://prop.kc2g.com/",
        RetrievedAtUtc: null,
        OwnNearestStation: null,
        WorkedNearestStation: null,
        MidpointNearestStation: null,
        BandRecommendations: Array.Empty<QsoMufBandRecommendationDto>(),
        Description: description);

    private static IReadOnlyList<Kc2gStationSample> ParseStations(string json)
    {
        using var document = JsonDocument.Parse(json);
        var stations = new List<Kc2gStationSample>();
        foreach (var item in document.RootElement.EnumerateArray())
        {
            if (!item.TryGetProperty("station", out var station)) continue;
            var name = ReadString(station, "name");
            var lat = ReadDouble(station, "latitude");
            var lon = ReadDouble(station, "longitude");
            var fof2 = ReadDouble(item, "fof2");
            var mufd = ReadDouble(item, "mufd");
            var confidence = ReadDouble(item, "cs");
            var source = ReadString(item, "source");
            var time = ReadDateTime(item, "time");
            if (string.IsNullOrWhiteSpace(name) || !lat.HasValue || !lon.HasValue) continue;

            stations.Add(new Kc2gStationSample(
                Name: name,
                Latitude: lat.Value,
                Longitude: NormalizeLongitude(lon.Value),
                Fof2Mhz: fof2,
                Muf3000Mhz: mufd,
                ConfidencePercent: confidence,
                Source: source,
                ObservedAtUtc: time));
        }

        return stations;
    }

    private static QsoMufStationDto? FindNearest(IReadOnlyList<Kc2gStationSample> stations, GeoPoint point)
    {
        Kc2gStationSample? nearest = null;
        double? nearestDistance = null;
        foreach (var station in stations)
        {
            var distance = DistanceKm(point.Latitude, point.Longitude, station.Latitude, station.Longitude);
            if (!nearestDistance.HasValue || distance < nearestDistance.Value)
            {
                nearest = station;
                nearestDistance = distance;
            }
        }

        return nearest is null
            ? null
            : new QsoMufStationDto(
                Name: nearest.Name,
                Latitude: nearest.Latitude,
                Longitude: nearest.Longitude,
                DistanceKm: Math.Round(nearestDistance!.Value, 0),
                Fof2Mhz: nearest.Fof2Mhz,
                Muf3000Mhz: nearest.Muf3000Mhz,
                ConfidencePercent: nearest.ConfidencePercent,
                Source: nearest.Source,
                ObservedAtUtc: nearest.ObservedAtUtc);
    }

    private static IReadOnlyList<QsoMufBandRecommendationDto> BuildBandRecommendations(double? muf3000)
    {
        var bands = new (string Band, double FrequencyMhz)[]
        {
            ("80m", 3.5),
            ("40m", 7.0),
            ("30m", 10.1),
            ("20m", 14.0),
            ("17m", 18.1),
            ("15m", 21.0),
            ("12m", 24.9),
            ("10m", 28.0)
        };

        return bands.Select(band =>
        {
            var supported = muf3000.HasValue && band.FrequencyMhz <= muf3000.Value;
            return new QsoMufBandRecommendationDto(
                Band: band.Band,
                FrequencyMhz: band.FrequencyMhz,
                Supported: supported,
                Reason: muf3000.HasValue
                    ? supported
                        ? $"MUF(3000) {muf3000.Value:0.0} MHz ligger over {band.Band}."
                        : $"MUF(3000) {muf3000.Value:0.0} MHz ligger under {band.Band}."
                    : "MUF(3000) er ukendt.");
        }).ToList();
    }

    private static string? ReadString(JsonElement item, string name)
    {
        if (!item.TryGetProperty(name, out var value)) return null;
        return value.ValueKind == JsonValueKind.String ? value.GetString() : value.ToString();
    }

    private static double? ReadDouble(JsonElement item, string name)
    {
        if (!item.TryGetProperty(name, out var value)) return null;
        if (value.ValueKind == JsonValueKind.Number) return value.GetDouble();
        return double.TryParse(value.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out var number) ? number : null;
    }

    private static DateTime? ReadDateTime(JsonElement item, string name)
    {
        var value = ReadString(item, name);
        return DateTime.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var date)
            ? date
            : null;
    }

    private static double DistanceKm(double lat1, double lon1, double lat2, double lon2)
    {
        const double radiusKm = 6371.0;
        var dLat = ToRadians(lat2 - lat1);
        var dLon = ToRadians(lon2 - lon1);
        var a = Math.Pow(Math.Sin(dLat / 2), 2)
            + Math.Cos(ToRadians(lat1)) * Math.Cos(ToRadians(lat2)) * Math.Pow(Math.Sin(dLon / 2), 2);
        return radiusKm * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }

    private static double NormalizeLongitude(double longitude)
    {
        while (longitude > 180) longitude -= 360;
        while (longitude < -180) longitude += 360;
        return longitude;
    }

    private static double ToRadians(double degrees) => degrees * Math.PI / 180.0;

    private record GeoPoint(double Latitude, double Longitude);

    private record Kc2gStationSample(
        string Name,
        double Latitude,
        double Longitude,
        double? Fof2Mhz,
        double? Muf3000Mhz,
        double? ConfidencePercent,
        string? Source,
        DateTime? ObservedAtUtc);
}
