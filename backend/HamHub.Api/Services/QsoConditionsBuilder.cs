using HamHub.Domain.Entities;
using HamHub.Domain.Enums;

namespace HamHub.Api.Services;

public static class QsoConditionsBuilder
{
    public static QsoConditionsDto Build(QsoEntry qso)
    {
        var ownLocation = BuildLocation(qso.OwnCallsign, qso.MyGridsquare, "Min station");
        var workedLocation = BuildLocation(qso.WorkedCallsign, qso.Locator, "Kontakt");
        var nearestHour = RoundToNearestHour(qso.DateUtc);

        double? distanceKm = null;
        double? bearingDegrees = null;
        if (ownLocation is not null && workedLocation is not null)
        {
            distanceKm = CalculateDistanceKm(
                ownLocation.Latitude,
                ownLocation.Longitude,
                workedLocation.Latitude,
                workedLocation.Longitude);
            bearingDegrees = CalculateBearingDegrees(
                ownLocation.Latitude,
                ownLocation.Longitude,
                workedLocation.Latitude,
                workedLocation.Longitude);
        }

        var basePropagation = NoaaSwpcPropagationService.Unavailable("NOAA SWPC data er ikke hentet endnu.") with
        {
            Path = BuildPath(ownLocation, workedLocation, qso.DateUtc),
            BandConditions = BuildBandConditions(qso, ownLocation, workedLocation)
        };

        return new QsoConditionsDto(
            QsoTimeUtc: DateTime.SpecifyKind(qso.DateUtc, DateTimeKind.Utc),
            NearestWeatherHourUtc: nearestHour,
            OwnLocation: ownLocation,
            WorkedLocation: workedLocation,
            DistanceKm: distanceKm.HasValue ? Math.Round(distanceKm.Value, 1) : null,
            BearingDegrees: bearingDegrees.HasValue ? Math.Round(bearingDegrees.Value, 0) : null,
            WeatherSource: "Open-Meteo Historical Weather API",
            Propagation: basePropagation);
    }

    public static bool TryGridToLatLng(string? grid, out double latitude, out double longitude)
    {
        latitude = 0;
        longitude = 0;
        if (string.IsNullOrWhiteSpace(grid)) return false;

        var locator = grid.Trim().ToUpperInvariant();
        if (locator.Length < 4) return false;
        if (locator[0] is < 'A' or > 'R' || locator[1] is < 'A' or > 'R') return false;
        if (!char.IsDigit(locator[2]) || !char.IsDigit(locator[3])) return false;

        longitude = (locator[0] - 'A') * 20 - 180;
        latitude = (locator[1] - 'A') * 10 - 90;
        longitude += (locator[2] - '0') * 2;
        latitude += locator[3] - '0';

        var lonWidth = 2.0;
        var latHeight = 1.0;

        if (locator.Length >= 6)
        {
            if (locator[4] is < 'A' or > 'X' || locator[5] is < 'A' or > 'X') return false;
            lonWidth = 2.0 / 24.0;
            latHeight = 1.0 / 24.0;
            longitude += (locator[4] - 'A') * lonWidth;
            latitude += (locator[5] - 'A') * latHeight;
        }

        longitude += lonWidth / 2.0;
        latitude += latHeight / 2.0;
        return true;
    }

    public static QsoConditionsDto WithWeather(QsoConditionsDto conditions, QsoWeatherDto? ownWeather, QsoWeatherDto? workedWeather)
    {
        var own = conditions.OwnLocation is null ? null : conditions.OwnLocation with { Weather = ownWeather };
        var worked = conditions.WorkedLocation is null ? null : conditions.WorkedLocation with { Weather = workedWeather };
        return conditions with { OwnLocation = own, WorkedLocation = worked };
    }

    public static QsoConditionsDto WithPropagation(QsoConditionsDto conditions, QsoPropagationDto propagation) =>
        conditions with
        {
            Propagation = propagation with
            {
                Path = conditions.Propagation.Path,
                BandConditions = conditions.Propagation.BandConditions,
                MufFof2 = conditions.Propagation.MufFof2
            }
        };

    public static QsoConditionsDto WithMufFof2(QsoConditionsDto conditions, QsoMufFof2Dto mufFof2) =>
        conditions with { Propagation = conditions.Propagation with { MufFof2 = mufFof2 } };

    private static QsoLocationConditionsDto? BuildLocation(string callsign, string? grid, string role)
    {
        if (!TryGridToLatLng(grid, out var latitude, out var longitude)) return null;

        return new QsoLocationConditionsDto(
            Callsign: callsign,
            Role: role,
            Grid: grid!.Trim().ToUpperInvariant(),
            Latitude: Math.Round(latitude, 5),
            Longitude: Math.Round(longitude, 5),
            Weather: null);
    }

    private static DateTime RoundToNearestHour(DateTime value)
    {
        var utc = value.Kind == DateTimeKind.Utc ? value : DateTime.SpecifyKind(value, DateTimeKind.Utc);
        var hour = new DateTime(utc.Year, utc.Month, utc.Day, utc.Hour, 0, 0, DateTimeKind.Utc);
        return utc.Minute >= 30 ? hour.AddHours(1) : hour;
    }

    private static double CalculateDistanceKm(double lat1, double lon1, double lat2, double lon2)
    {
        const double radiusKm = 6371.0;
        var dLat = ToRadians(lat2 - lat1);
        var dLon = ToRadians(lon2 - lon1);
        var a = Math.Pow(Math.Sin(dLat / 2), 2)
            + Math.Cos(ToRadians(lat1)) * Math.Cos(ToRadians(lat2)) * Math.Pow(Math.Sin(dLon / 2), 2);
        return radiusKm * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }

    private static double CalculateBearingDegrees(double lat1, double lon1, double lat2, double lon2)
    {
        var y = Math.Sin(ToRadians(lon2 - lon1)) * Math.Cos(ToRadians(lat2));
        var x = Math.Cos(ToRadians(lat1)) * Math.Sin(ToRadians(lat2))
            - Math.Sin(ToRadians(lat1)) * Math.Cos(ToRadians(lat2)) * Math.Cos(ToRadians(lon2 - lon1));
        return (ToDegrees(Math.Atan2(y, x)) + 360) % 360;
    }

    private static double ToRadians(double degrees) => degrees * Math.PI / 180.0;
    private static double ToDegrees(double radians) => radians * 180.0 / Math.PI;

    private static QsoPropagationPathDto? BuildPath(QsoLocationConditionsDto? own, QsoLocationConditionsDto? worked, DateTime qsoTimeUtc)
    {
        if (own is null || worked is null) return null;

        var ownElevation = SolarElevationDegrees(qsoTimeUtc, own.Latitude, own.Longitude);
        var workedElevation = SolarElevationDegrees(qsoTimeUtc, worked.Latitude, worked.Longitude);
        var midpointLat = (own.Latitude + worked.Latitude) / 2.0;
        var midpointLon = NormalizeLongitude((own.Longitude + worked.Longitude) / 2.0);
        var midpointElevation = SolarElevationDegrees(qsoTimeUtc, midpointLat, midpointLon);
        var ownLight = LightLabel(ownElevation);
        var workedLight = LightLabel(workedElevation);
        var midpointLight = LightLabel(midpointElevation);

        return new QsoPropagationPathDto(
            OwnLight: ownLight,
            WorkedLight: workedLight,
            MidpointLight: midpointLight,
            OwnSolarElevationDegrees: Math.Round(ownElevation, 1),
            WorkedSolarElevationDegrees: Math.Round(workedElevation, 1),
            MidpointSolarElevationDegrees: Math.Round(midpointElevation, 1),
            Summary: PathSummary(ownLight, workedLight, midpointLight));
    }

    private static IReadOnlyList<QsoBandConditionDto> BuildBandConditions(
        QsoEntry qso,
        QsoLocationConditionsDto? own,
        QsoLocationConditionsDto? worked)
    {
        var path = BuildPath(own, worked, qso.DateUtc);
        var daylight = path is not null && (path.OwnLight == "Dagslys" || path.WorkedLight == "Dagslys" || path.MidpointLight == "Dagslys");
        var darkness = path is not null && path.OwnLight == "Mørke" && path.WorkedLight == "Mørke";
        var grayline = path is not null && (path.OwnLight == "Grayline" || path.WorkedLight == "Grayline" || path.MidpointLight == "Grayline");
        var current = BandLabel(qso.Band);

        var bands = new[] { "160m", "80m", "40m", "30m", "20m", "17m", "15m", "12m", "10m" };
        return bands.Select(band =>
        {
            var rating = BandRating(band, daylight, darkness, grayline);
            return new QsoBandConditionDto(
                Band: band,
                Rating: rating,
                Reason: BandReason(band, rating, daylight, darkness, grayline),
                IsCurrentQsoBand: band == current);
        }).ToList();
    }

    private static string BandRating(string band, bool daylight, bool darkness, bool grayline)
    {
        if (grayline && band is "160m" or "80m" or "40m") return "God";
        if (darkness && band is "160m" or "80m" or "40m") return "God";
        if (daylight && band is "20m" or "17m" or "15m") return "God";
        if (daylight && band is "160m" or "80m") return "Svag";
        if (darkness && band is "15m" or "12m" or "10m") return "Svag";
        return "Ok";
    }

    private static string BandReason(string band, string rating, bool daylight, bool darkness, bool grayline)
    {
        if (grayline && band is "160m" or "80m" or "40m") return "Grayline kan løfte lave bånd.";
        if (darkness && band is "160m" or "80m" or "40m") return "Mørkesti passer ofte godt til lave bånd.";
        if (daylight && band is "20m" or "17m" or "15m") return "Dagslys og højere ionisering passer godt til dette HF-bånd.";
        if (rating == "Svag") return "Dagslys/mørke passer mindre godt til dette bånd på denne rute.";
        return "Forholdene er neutrale ud fra dagslys og rute alene.";
    }

    private static string BandLabel(Band band) => band switch
    {
        Band.M160 => "160m",
        Band.M80 => "80m",
        Band.M40 => "40m",
        Band.M30 => "30m",
        Band.M20 => "20m",
        Band.M17 => "17m",
        Band.M15 => "15m",
        Band.M12 => "12m",
        Band.M10 => "10m",
        _ => ""
    };

    private static string LightLabel(double elevation)
    {
        if (elevation >= 0) return "Dagslys";
        if (elevation >= -6) return "Grayline";
        return "Mørke";
    }

    private static string PathSummary(string ownLight, string workedLight, string midpointLight)
    {
        if (ownLight == "Dagslys" && workedLight == "Dagslys" && midpointLight == "Dagslys") return "Dagslysrute";
        if (ownLight == "Mørke" && workedLight == "Mørke" && midpointLight == "Mørke") return "Mørkerute";
        if (ownLight == "Grayline" || workedLight == "Grayline" || midpointLight == "Grayline") return "Grayline tæt på ruten";
        return "Blandet lys/mørke";
    }

    private static double SolarElevationDegrees(DateTime value, double latitude, double longitude)
    {
        var utc = value.Kind == DateTimeKind.Utc ? value : DateTime.SpecifyKind(value, DateTimeKind.Utc);
        var dayOfYear = utc.DayOfYear;
        var hour = utc.Hour + utc.Minute / 60.0 + utc.Second / 3600.0;
        var gamma = 2.0 * Math.PI / 365.0 * (dayOfYear - 1 + (hour - 12.0) / 24.0);
        var declination = 0.006918
            - 0.399912 * Math.Cos(gamma)
            + 0.070257 * Math.Sin(gamma)
            - 0.006758 * Math.Cos(2 * gamma)
            + 0.000907 * Math.Sin(2 * gamma)
            - 0.002697 * Math.Cos(3 * gamma)
            + 0.00148 * Math.Sin(3 * gamma);
        var equationOfTime = 229.18 * (0.000075
            + 0.001868 * Math.Cos(gamma)
            - 0.032077 * Math.Sin(gamma)
            - 0.014615 * Math.Cos(2 * gamma)
            - 0.040849 * Math.Sin(2 * gamma));
        var trueSolarMinutes = (hour * 60.0 + equationOfTime + 4.0 * longitude) % 1440.0;
        if (trueSolarMinutes < 0) trueSolarMinutes += 1440.0;
        var hourAngle = trueSolarMinutes / 4.0 - 180.0;
        var latRad = ToRadians(latitude);
        var zenith = Math.Acos(
            Math.Sin(latRad) * Math.Sin(declination)
            + Math.Cos(latRad) * Math.Cos(declination) * Math.Cos(ToRadians(hourAngle)));
        return 90.0 - ToDegrees(zenith);
    }

    private static double NormalizeLongitude(double longitude)
    {
        while (longitude > 180) longitude -= 360;
        while (longitude < -180) longitude += 360;
        return longitude;
    }
}

public record QsoConditionsDto(
    DateTime QsoTimeUtc,
    DateTime NearestWeatherHourUtc,
    QsoLocationConditionsDto? OwnLocation,
    QsoLocationConditionsDto? WorkedLocation,
    double? DistanceKm,
    double? BearingDegrees,
    string WeatherSource,
    QsoPropagationDto Propagation);

public record QsoLocationConditionsDto(
    string Callsign,
    string Role,
    string Grid,
    double Latitude,
    double Longitude,
    QsoWeatherDto? Weather);

public record QsoWeatherDto(
    DateTime TimeUtc,
    double? TemperatureC,
    double? RelativeHumidityPercent,
    double? PressureHpa,
    double? CloudCoverPercent,
    double? WindSpeedKmh,
    double? WindDirectionDegrees,
    double? PrecipitationMm);

public record QsoPropagationDto(
    string Status,
    string Description,
    string Source,
    DateTime? ObservedAtUtc,
    double? KpIndex,
    string? GeomagneticScale,
    string? RadioBlackoutScale,
    string? SolarRadiationScale,
    double? SolarWindSpeedKms,
    double? SolarWindDensity,
    double? InterplanetaryMagneticFieldBz,
    double? InterplanetaryMagneticFieldBt,
    double? MinutesFromQso,
    double? SolarFluxIndex,
    double? ForecastApIndex,
    double? SunspotNumber,
    string? SolarCyclePhase,
    double? SolarCycleProgressPercent,
    string? XrayClass,
    double? XrayFlux,
    QsoDRegionAbsorptionDto DRegionAbsorption,
    QsoPropagationPathDto? Path,
    IReadOnlyList<QsoBandConditionDto> BandConditions,
    string MufStatus,
    string MufSourceUrl,
    QsoMufFof2Dto MufFof2);

public record QsoDRegionAbsorptionDto(string Product, string Impact, string SourceUrl);

public record QsoPropagationPathDto(
    string OwnLight,
    string WorkedLight,
    string MidpointLight,
    double OwnSolarElevationDegrees,
    double WorkedSolarElevationDegrees,
    double MidpointSolarElevationDegrees,
    string Summary);

public record QsoBandConditionDto(string Band, string Rating, string Reason, bool IsCurrentQsoBand);

public record QsoMufFof2Dto(
    string Status,
    string Source,
    string SourceUrl,
    DateTime? RetrievedAtUtc,
    QsoMufStationDto? OwnNearestStation,
    QsoMufStationDto? WorkedNearestStation,
    QsoMufStationDto? MidpointNearestStation,
    IReadOnlyList<QsoMufBandRecommendationDto> BandRecommendations,
    string Description);

public record QsoMufStationDto(
    string Name,
    double Latitude,
    double Longitude,
    double DistanceKm,
    double? Fof2Mhz,
    double? Muf3000Mhz,
    double? ConfidencePercent,
    string? Source,
    DateTime? ObservedAtUtc);

public record QsoMufBandRecommendationDto(string Band, double FrequencyMhz, bool Supported, string Reason);
