using System.Globalization;
using System.Text.RegularExpressions;

namespace HamHub.Infrastructure.Services;

public class LotwApiException(string message) : Exception(message);

public record LotwQslRecord(
    string Call,
    DateTime TimeOn,
    string Band,
    string Mode,
    DateTime? QslDate,
    DateTime? ReceivedAt,
    string? Gridsquare,
    string? Country,
    int? Dxcc,
    string? Continent,
    string? State,
    int? CqZone,
    int? ItuZone,
    string? Iota);

public class LotwReportClient
{
    private static readonly Uri ReportUri = new("https://lotw.arrl.org/lotwuser/lotwreport.adi");
    private readonly HttpClient _http;

    public LotwReportClient(HttpClient http)
    {
        _http = http;
    }

    public async Task<IReadOnlyList<LotwQslRecord>> FetchConfirmedQsosAsync(
        string username,
        string password,
        DateTime? sinceUtc,
        CancellationToken ct)
    {
        var query = new Dictionary<string, string?>
        {
            ["login"] = username,
            ["password"] = password,
            ["qso_query"] = "1",
            ["qso_qsl"] = "yes",
            ["qso_withown"] = "yes",
            ["qso_qsldetail"] = "yes",
        };

        if (sinceUtc.HasValue)
        {
            query["qso_qslsince"] = sinceUtc.Value.ToUniversalTime().ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture);
        }

        var builder = new UriBuilder(ReportUri)
        {
            Query = string.Join("&", query
                .Where(pair => !string.IsNullOrWhiteSpace(pair.Value))
                .Select(pair => $"{Uri.EscapeDataString(pair.Key)}={Uri.EscapeDataString(pair.Value!)}"))
        };

        var adif = await _http.GetStringAsync(builder.Uri, ct);
        return ParseAdif(adif);
    }

    public static IReadOnlyList<LotwQslRecord> ParseAdif(string adif)
    {
        if (string.IsNullOrWhiteSpace(adif) ||
            !adif.Contains("<EOH>", StringComparison.OrdinalIgnoreCase) ||
            adif.Contains("<html", StringComparison.OrdinalIgnoreCase))
        {
            throw new LotwApiException("LoTW returnerede ikke et gyldigt ADIF-svar. Kontroller brugernavn og adgangskode.");
        }

        var result = new List<LotwQslRecord>();
        var records = Regex.Split(adif, "<eor>", RegexOptions.IgnoreCase)
            .Select(record => record.Trim())
            .Where(record => record.Length > 0);

        foreach (var record in records)
        {
            var call = GetField(record, "CALL");
            var date = GetField(record, "QSO_DATE");
            var time = GetField(record, "TIME_ON") ?? "0000";
            var band = GetField(record, "BAND");
            var mode = NormalizeMode(GetField(record, "MODE"), GetField(record, "SUBMODE"), GetField(record, "APP_LoTW_MODE"));

            if (call is null || date is null || band is null || mode is null) continue;
            if (!TryParseQsoTime(date, time, out var timeOn)) continue;

            result.Add(new LotwQslRecord(
                Call: call.ToUpperInvariant(),
                TimeOn: timeOn,
                Band: band.ToUpperInvariant(),
                Mode: mode.ToUpperInvariant(),
                QslDate: ParseAdifDate(GetField(record, "QSLRDATE")),
                ReceivedAt: ParseLotwTimestamp(GetField(record, "APP_LoTW_RXQSL")),
                Gridsquare: NormalizeAwardText(GetField(record, "GRIDSQUARE")),
                Country: NormalizeAwardText(GetField(record, "COUNTRY")),
                Dxcc: ParseAdifInt(GetField(record, "DXCC")),
                Continent: NormalizeAwardText(GetField(record, "CONT")),
                State: NormalizeAwardText(GetField(record, "STATE")),
                CqZone: ParseAdifInt(GetField(record, "CQZ")),
                ItuZone: ParseAdifInt(GetField(record, "ITUZ")),
                Iota: NormalizeAwardText(GetField(record, "IOTA"))));
        }

        return result;
    }

    private static string? NormalizeMode(string? mode, string? submode, string? appLotwMode)
    {
        var normalizedMode = NormalizeAwardText(mode)?.ToUpperInvariant();
        var normalizedSubmode = NormalizeAwardText(submode)?.ToUpperInvariant();
        var normalizedAppMode = NormalizeAwardText(appLotwMode)?.ToUpperInvariant();

        var modeIsGenericDigital =
            string.Equals(normalizedMode, "MFSK", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(normalizedMode, "DATA", StringComparison.OrdinalIgnoreCase);

        if (modeIsGenericDigital && !string.IsNullOrWhiteSpace(normalizedSubmode))
        {
            return normalizedSubmode;
        }

        if (modeIsGenericDigital && !string.IsNullOrWhiteSpace(normalizedAppMode))
        {
            return normalizedAppMode;
        }

        return normalizedMode ?? normalizedAppMode ?? normalizedSubmode;
    }

    private static bool TryParseQsoTime(string date, string time, out DateTime timeOn)
    {
        var paddedTime = time.PadRight(6, '0')[..6];
        if (DateTime.TryParseExact(
                date + paddedTime,
                "yyyyMMddHHmmss",
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out var parsed))
        {
            timeOn = DateTime.SpecifyKind(parsed, DateTimeKind.Utc);
            return true;
        }

        timeOn = default;
        return false;
    }

    private static DateTime? ParseAdifDate(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        return DateTime.TryParseExact(value, "yyyyMMdd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date)
            ? new DateTime(date.Year, date.Month, date.Day, 0, 0, 0, DateTimeKind.Utc)
            : null;
    }

    private static int? ParseAdifInt(string? value)
    {
        return int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed)
            ? parsed
            : null;
    }

    private static string? NormalizeAwardText(string? value)
    {
        var normalized = value?.Trim();
        return string.IsNullOrWhiteSpace(normalized) ? null : normalized;
    }

    private static DateTime? ParseLotwTimestamp(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        return DateTime.TryParseExact(
            value,
            "yyyy-MM-dd HH:mm:ss",
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out var timestamp)
            ? DateTime.SpecifyKind(timestamp, DateTimeKind.Utc)
            : null;
    }

    private static string? GetField(string record, string name)
    {
        var pattern = $"<{name}:";
        var idx = record.IndexOf(pattern, StringComparison.OrdinalIgnoreCase);
        if (idx < 0) return null;

        var colonIdx = record.IndexOf('>', idx);
        if (colonIdx < 0) return null;

        var lenStr = record[(idx + name.Length + 2)..colonIdx];
        if (!int.TryParse(lenStr.Split(':')[0], out var len)) return null;

        var start = colonIdx + 1;
        if (start + len > record.Length) return null;

        return record.Substring(start, len);
    }
}
