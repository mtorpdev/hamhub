using System.Globalization;
using System.Text.Json;

namespace HamHub.Api.Services;

public class NoaaSwpcPropagationService
{
    private readonly HttpClient _httpClient;

    public NoaaSwpcPropagationService(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<QsoPropagationDto> GetPropagationAsync(DateTime qsoTimeUtc, CancellationToken ct)
    {
        try
        {
            var kpTask = _httpClient.GetStringAsync("https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json", ct);
            var scalesTask = _httpClient.GetStringAsync("https://services.swpc.noaa.gov/products/noaa-scales.json", ct);
            var plasmaTask = _httpClient.GetStringAsync("https://services.swpc.noaa.gov/products/solar-wind/plasma-7-day.json", ct);
            var magTask = _httpClient.GetStringAsync("https://services.swpc.noaa.gov/products/solar-wind/mag-7-day.json", ct);
            var forecastTask = _httpClient.GetStringAsync("https://services.swpc.noaa.gov/json/45-day-forecast.json", ct);
            var solarCycleTask = _httpClient.GetStringAsync("https://services.swpc.noaa.gov/products/solar-cycle-25-ssn-predicted-range.json", ct);
            var xrayTask = _httpClient.GetStringAsync("https://services.swpc.noaa.gov/json/goes/primary/xrays-1-day.json", ct);

            await Task.WhenAll(kpTask, scalesTask, plasmaTask, magTask, forecastTask, solarCycleTask, xrayTask);
            return BuildPropagation(qsoTimeUtc, kpTask.Result, scalesTask.Result, plasmaTask.Result, magTask.Result, forecastTask.Result, solarCycleTask.Result, xrayTask.Result);
        }
        catch
        {
            return Unavailable("NOAA SWPC data kunne ikke hentes lige nu.");
        }
    }

    public static QsoPropagationDto BuildPropagation(
        DateTime qsoTimeUtc,
        string kpJson,
        string scalesJson,
        string plasmaJson,
        string magJson,
        string forecast45DayJson,
        string solarCycleJson,
        string xrayJson)
    {
        var target = qsoTimeUtc.Kind == DateTimeKind.Utc
            ? qsoTimeUtc
            : DateTime.SpecifyKind(qsoTimeUtc, DateTimeKind.Utc);
        var kp = ParseNearestKp(target, kpJson);
        var scales = ParseScales(scalesJson);
        var plasma = ParseNearestPlasma(target, plasmaJson);
        var mag = ParseNearestMag(target, magJson);
        var forecast = ParseNearestForecast(target, forecast45DayJson);
        var solarCycle = ParseSolarCycle(target, solarCycleJson);
        var xray = ParseNearestXray(target, xrayJson);
        var observedAt = NearestTimestamp(target, kp?.ObservedAtUtc, plasma?.ObservedAtUtc, mag?.ObservedAtUtc);
        double? minutesFromQso = observedAt.HasValue ? Math.Abs((observedAt.Value - target).TotalMinutes) : null;
        var status = BuildStatus(kp?.KpIndex, scales.GeomagneticScale);

        return new QsoPropagationDto(
            Status: status,
            Description: BuildDescription(kp?.KpIndex, scales.GeomagneticScale, minutesFromQso),
            Source: "NOAA SWPC",
            ObservedAtUtc: observedAt,
            KpIndex: kp?.KpIndex,
            GeomagneticScale: scales.GeomagneticScale,
            RadioBlackoutScale: scales.RadioBlackoutScale,
            SolarRadiationScale: scales.SolarRadiationScale,
            SolarWindSpeedKms: plasma?.SpeedKms,
            SolarWindDensity: plasma?.Density,
            InterplanetaryMagneticFieldBz: mag?.Bz,
            InterplanetaryMagneticFieldBt: mag?.Bt,
            MinutesFromQso: minutesFromQso.HasValue ? Math.Round(minutesFromQso.Value, 0) : null,
            SolarFluxIndex: forecast.F107,
            ForecastApIndex: forecast.Ap,
            SunspotNumber: solarCycle.SunspotNumber,
            SolarCyclePhase: solarCycle.Phase,
            SolarCycleProgressPercent: solarCycle.ProgressPercent,
            XrayClass: xray.Class,
            XrayFlux: xray.Flux,
            DRegionAbsorption: BuildDRegionAbsorption(xray.Class),
            Path: null,
            BandConditions: Array.Empty<QsoBandConditionDto>(),
            MufStatus: "MUF/foF2 er ikke koblet til en stabil datakilde endnu.",
            MufSourceUrl: "https://prop.kc2g.com/about/",
            MufFof2: Kc2gMufFof2Service.Unavailable("KC2G MUF/foF2 data er ikke hentet endnu."));
    }

    public static QsoPropagationDto Unavailable(string description) => new(
        Status: "Ikke tilgængelig",
        Description: description,
        Source: "NOAA SWPC",
        ObservedAtUtc: null,
        KpIndex: null,
        GeomagneticScale: null,
        RadioBlackoutScale: null,
        SolarRadiationScale: null,
        SolarWindSpeedKms: null,
        SolarWindDensity: null,
        InterplanetaryMagneticFieldBz: null,
        InterplanetaryMagneticFieldBt: null,
        MinutesFromQso: null,
        SolarFluxIndex: null,
        ForecastApIndex: null,
        SunspotNumber: null,
        SolarCyclePhase: null,
        SolarCycleProgressPercent: null,
        XrayClass: null,
        XrayFlux: null,
        DRegionAbsorption: new QsoDRegionAbsorptionDto(
            "D-RAP",
            "NOAA D-RAP kunne ikke vurderes lige nu.",
            "https://www.swpc.noaa.gov/products/d-region-absorption-predictions-d-rap"),
        Path: null,
        BandConditions: Array.Empty<QsoBandConditionDto>(),
        MufStatus: "MUF/foF2 er ikke koblet til en stabil datakilde endnu.",
        MufSourceUrl: "https://prop.kc2g.com/about/",
        MufFof2: Kc2gMufFof2Service.Unavailable("KC2G MUF/foF2 data kunne ikke hentes lige nu."));

    private static KpSample? ParseNearestKp(DateTime target, string json)
    {
        using var document = JsonDocument.Parse(json);
        KpSample? nearest = null;
        foreach (var item in document.RootElement.EnumerateArray())
        {
            if (!item.TryGetProperty("time_tag", out var timeElement)) continue;
            if (!TryParseUtc(timeElement.GetString(), out var time)) continue;
            if (!item.TryGetProperty("Kp", out var kpElement) || kpElement.ValueKind != JsonValueKind.Number) continue;

            var sample = new KpSample(time, kpElement.GetDouble());
            nearest = IsNearer(target, sample.ObservedAtUtc, nearest?.ObservedAtUtc) ? sample : nearest;
        }

        return nearest;
    }

    private static ScaleSample ParseScales(string json)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        if (!root.TryGetProperty("0", out var current)) return new ScaleSample(null, null, null);

        return new ScaleSample(
            GeomagneticScale: ReadScale(current, "G"),
            RadioBlackoutScale: ReadScale(current, "R"),
            SolarRadiationScale: ReadScale(current, "S"));
    }

    private static PlasmaSample? ParseNearestPlasma(DateTime target, string json)
    {
        using var document = JsonDocument.Parse(json);
        PlasmaSample? nearest = null;
        foreach (var row in document.RootElement.EnumerateArray().Skip(1))
        {
            if (row.GetArrayLength() < 3) continue;
            if (!TryParseUtc(row[0].GetString(), out var time)) continue;
            var density = TryParseDouble(row[1].GetString());
            var speed = TryParseDouble(row[2].GetString());
            var sample = new PlasmaSample(time, density, speed);
            nearest = IsNearer(target, sample.ObservedAtUtc, nearest?.ObservedAtUtc) ? sample : nearest;
        }

        return nearest;
    }

    private static MagSample? ParseNearestMag(DateTime target, string json)
    {
        using var document = JsonDocument.Parse(json);
        MagSample? nearest = null;
        foreach (var row in document.RootElement.EnumerateArray().Skip(1))
        {
            if (row.GetArrayLength() < 7) continue;
            if (!TryParseUtc(row[0].GetString(), out var time)) continue;
            var bz = TryParseDouble(row[3].GetString());
            var bt = TryParseDouble(row[6].GetString());
            var sample = new MagSample(time, bz, bt);
            nearest = IsNearer(target, sample.ObservedAtUtc, nearest?.ObservedAtUtc) ? sample : nearest;
        }

        return nearest;
    }

    private static ForecastSample ParseNearestForecast(DateTime target, string json)
    {
        using var document = JsonDocument.Parse(json);
        if (!document.RootElement.TryGetProperty("data", out var data)) return new ForecastSample(null, null);

        double? ap = null;
        double? f107 = null;
        DateTime? nearestAp = null;
        DateTime? nearestF107 = null;
        foreach (var item in data.EnumerateArray())
        {
            if (!item.TryGetProperty("time", out var timeElement)) continue;
            if (!TryParseUtc(timeElement.GetString(), out var time)) continue;
            if (!item.TryGetProperty("metric", out var metricElement)) continue;
            if (!item.TryGetProperty("value", out var valueElement) || valueElement.ValueKind != JsonValueKind.Number) continue;

            var metric = metricElement.GetString();
            if (metric == "ap" && IsNearer(target, time, nearestAp))
            {
                nearestAp = time;
                ap = valueElement.GetDouble();
            }
            else if (metric == "f107" && IsNearer(target, time, nearestF107))
            {
                nearestF107 = time;
                f107 = valueElement.GetDouble();
            }
        }

        return new ForecastSample(ap, f107);
    }

    private static SolarCycleSample ParseSolarCycle(DateTime target, string json)
    {
        using var document = JsonDocument.Parse(json);
        SolarCyclePoint? current = null;
        SolarCyclePoint? next = null;
        SolarCyclePoint? peak = null;
        foreach (var item in document.RootElement.EnumerateArray())
        {
            if (!item.TryGetProperty("time-tag", out var timeElement)) continue;
            if (!DateTime.TryParseExact(timeElement.GetString(), "yyyy-MM", CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var month)) continue;
            var min = ReadOptionalNumber(item, "smoothed_ssn_min");
            var max = ReadOptionalNumber(item, "smoothed_ssn_max");
            if (!min.HasValue || !max.HasValue) continue;

            var point = new SolarCyclePoint(DateTime.SpecifyKind(month, DateTimeKind.Utc), (min.Value + max.Value) / 2);
            if (point.Month.Year == target.Year && point.Month.Month == target.Month) current = point;
            if (point.Month.Year == target.AddMonths(1).Year && point.Month.Month == target.AddMonths(1).Month) next = point;
            if (peak is null || point.SunspotNumber > peak.SunspotNumber) peak = point;
        }

        if (current is null) return new SolarCycleSample(null, null, null);
        var progress = peak is null || peak.SunspotNumber <= 0
            ? null
            : (double?)Math.Clamp(Math.Round(current.SunspotNumber / peak.SunspotNumber * 100, 0), 0, 100);
        var phase = next is null
            ? null
            : next.SunspotNumber >= current.SunspotNumber ? "Stigende" : "Aftagende";
        return new SolarCycleSample(Math.Round(current.SunspotNumber, 0), phase, progress);
    }

    private static XraySample ParseNearestXray(DateTime target, string json)
    {
        using var document = JsonDocument.Parse(json);
        XraySample? nearest = null;
        foreach (var item in document.RootElement.EnumerateArray())
        {
            if (!item.TryGetProperty("energy", out var energyElement) || energyElement.GetString() != "0.1-0.8nm") continue;
            if (!item.TryGetProperty("time_tag", out var timeElement)) continue;
            if (!TryParseUtc(timeElement.GetString(), out var time)) continue;
            if (!item.TryGetProperty("flux", out var fluxElement) || fluxElement.ValueKind != JsonValueKind.Number) continue;
            var flux = fluxElement.GetDouble();
            var sample = new XraySample(time, flux, XrayClass(flux));
            nearest = IsNearer(target, time, nearest?.ObservedAtUtc) ? sample : nearest;
        }

        return nearest ?? new XraySample(null, null, null);
    }

    private static string? XrayClass(double? flux)
    {
        if (!flux.HasValue || flux <= 0) return null;
        var value = flux.Value;
        if (value >= 1e-4) return $"X{(value / 1e-4).ToString("0.0", CultureInfo.InvariantCulture)}";
        if (value >= 1e-5) return $"M{(value / 1e-5).ToString("0.0", CultureInfo.InvariantCulture)}";
        if (value >= 1e-6) return $"C{(value / 1e-6).ToString("0.0", CultureInfo.InvariantCulture)}";
        if (value >= 1e-7) return $"B{(value / 1e-7).ToString("0.0", CultureInfo.InvariantCulture)}";
        return $"A{(value / 1e-8).ToString("0.0", CultureInfo.InvariantCulture)}";
    }

    private static QsoDRegionAbsorptionDto BuildDRegionAbsorption(string? xrayClass)
    {
        var impact = xrayClass switch
        {
            null => "X-ray data ikke tilgængelig.",
            var x when x.StartsWith("X", StringComparison.Ordinal) => "Kraftig HF absorption/blackout sandsynlig på solbelyst side",
            var x when x.StartsWith("M", StringComparison.Ordinal) => "Mindre HF absorption mulig på solbelyst side",
            var x when x.StartsWith("C", StringComparison.Ordinal) => "Lav D-region absorption; HF bør kun være let påvirket",
            _ => "Ingen væsentlig D-region absorption forventet"
        };

        return new QsoDRegionAbsorptionDto(
            "D-RAP",
            impact,
            "https://www.swpc.noaa.gov/products/d-region-absorption-predictions-d-rap");
    }

    private static string? ReadScale(JsonElement current, string key)
    {
        if (!current.TryGetProperty(key, out var scaleRoot)) return null;
        if (!scaleRoot.TryGetProperty("Scale", out var scale)) return null;
        var value = scale.GetString();
        return string.IsNullOrWhiteSpace(value) ? null : $"{key}{value}";
    }

    private static DateTime? NearestTimestamp(DateTime target, params DateTime?[] values)
    {
        DateTime? nearest = null;
        foreach (var value in values)
        {
            if (!value.HasValue) continue;
            nearest = IsNearer(target, value.Value, nearest) ? value.Value : nearest;
        }

        return nearest;
    }

    private static bool IsNearer(DateTime target, DateTime candidate, DateTime? current)
    {
        if (!current.HasValue) return true;
        return Math.Abs((candidate - target).TotalSeconds) < Math.Abs((current.Value - target).TotalSeconds);
    }

    private static bool TryParseUtc(string? value, out DateTime result)
    {
        result = default;
        if (string.IsNullOrWhiteSpace(value)) return false;
        var normalized = value.Replace(' ', 'T').Replace(".000", "");
        return DateTime.TryParse(
            normalized,
            CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
            out result);
    }

    private static double? TryParseDouble(string? value) =>
        double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out var number) ? number : null;

    private static double? ReadOptionalNumber(JsonElement item, string name) =>
        item.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.Number ? value.GetDouble() : null;

    private static string BuildStatus(double? kp, string? geomagneticScale)
    {
        if (!kp.HasValue && string.IsNullOrWhiteSpace(geomagneticScale)) return "Ukendt";
        if (kp >= 9) return "Ekstrem geomagnetisk storm";
        if (kp >= 8) return "Kraftig geomagnetisk storm";
        if (kp >= 7) return "Stærk geomagnetisk storm";
        if (kp >= 6) return "Moderat geomagnetisk storm";
        if (kp >= 5 || geomagneticScale is "G1") return "Mindre geomagnetisk storm";
        if (kp >= 4) return "Aktive geomagnetiske forhold";
        return "Rolige geomagnetiske forhold";
    }

    private static string BuildDescription(double? kp, string? geomagneticScale, double? minutesFromQso)
    {
        var kpText = kp.HasValue ? $"Kp {kp.Value:0.##}" : "Kp ukendt";
        var scaleText = string.IsNullOrWhiteSpace(geomagneticScale) ? "G-skala ukendt" : geomagneticScale;
        var timing = minutesFromQso.HasValue
            ? $"Nærmeste NOAA SWPC datapunkt ligger ca. {minutesFromQso.Value:0} minutter fra QSO-tidspunktet."
            : "Der blev ikke fundet et timestamp tæt på QSO-tidspunktet.";
        return $"{kpText} / {scaleText}. {BuildStatus(kp, geomagneticScale)}. {timing}";
    }

    private record KpSample(DateTime ObservedAtUtc, double KpIndex);
    private record PlasmaSample(DateTime ObservedAtUtc, double? Density, double? SpeedKms);
    private record MagSample(DateTime ObservedAtUtc, double? Bz, double? Bt);
    private record ScaleSample(string? GeomagneticScale, string? RadioBlackoutScale, string? SolarRadiationScale);
    private record ForecastSample(double? Ap, double? F107);
    private record SolarCyclePoint(DateTime Month, double SunspotNumber);
    private record SolarCycleSample(double? SunspotNumber, string? Phase, double? ProgressPercent);
    private record XraySample(DateTime? ObservedAtUtc, double? Flux, string? Class);
}
