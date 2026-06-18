using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using System.Xml.Linq;

namespace HamHub.Infrastructure.Services;

public class QrzApiException(string message) : Exception(message);

public record QrzCallsignDto(
    string Callsign,
    string? Name,
    string? Country,
    string? Grid,
    int? Dxcc,
    string? QslVia,
    string? ImageUrl,
    string? Email
);

public record AdifQso(
    string Call,
    DateTime TimeOn,
    string Band,
    string Mode,
    string? RstSent,
    string? RstReceived,
    string? Submode,
    string? Gridsquare,
    string? MyGridsquare,
    string? Country,
    int? Dxcc,
    string? Continent,
    string? State,
    string? County,
    string? Iota,
    string? PotaRefs,
    string? SotaRefs,
    string? AwardRefs,
    string? Name,
    string? Qth,
    double? TxPower,
    string? Comment,
    string? LogId,
    string? QrzStatus,
    DateTime? QrzQslDate
);

public class QrzClient
{
    private static readonly XNamespace Ns = "http://xmldata.qrz.com";
    private readonly HttpClient _http;
    private readonly IMemoryCache _cache;
    private readonly ILogger<QrzClient> _logger;

    public QrzClient(HttpClient http, IMemoryCache cache, ILogger<QrzClient> logger)
    {
        _http = http;
        _cache = cache;
        _logger = logger;
    }

    public async Task<string> GetSessionKeyAsync(string username, string password, CancellationToken ct)
    {
        var cacheKey = $"qrz:session:{username.ToLowerInvariant()}";
        if (_cache.TryGetValue(cacheKey, out string? cached) && cached != null)
            return cached;

        var url = $"https://xmldata.qrz.com/xml/current/?username={Uri.EscapeDataString(username)}&password={Uri.EscapeDataString(password)}&agent=hamhub";
        var xml = await _http.GetStringAsync(url, ct);
        var doc = XDocument.Parse(xml);

        var sessionError = doc.Root?.Element(Ns + "Session")?.Element(Ns + "Error")?.Value;
        if (sessionError != null)
            throw new QrzApiException($"QRZ XML login fejlede: {sessionError}");

        var key = doc.Root?.Element(Ns + "Session")?.Element(Ns + "Key")?.Value;
        if (string.IsNullOrWhiteSpace(key))
            throw new QrzApiException("QRZ returnerede ingen session-nøgle");

        _cache.Set(cacheKey, key, TimeSpan.FromHours(1));
        return key;
    }

    public async Task<QrzCallsignDto?> LookupCallsignAsync(string callsign, string apiKey, CancellationToken ct)
    {
        var cacheKey = $"qrz:call:{callsign.ToUpperInvariant()}";
        if (_cache.TryGetValue(cacheKey, out QrzCallsignDto? cached))
            return cached;

        var url = $"https://xmldata.qrz.com/xml/current/?s={Uri.EscapeDataString(apiKey)};callsign={Uri.EscapeDataString(callsign)}";
        var xml = await _http.GetStringAsync(url, ct);

        var doc = XDocument.Parse(xml);

        // Check for session-level errors (invalid key, quota exceeded, etc.)
        var sessionError = doc.Root?.Element(Ns + "Session")?.Element(Ns + "Error")?.Value;
        if (sessionError != null)
            throw new QrzApiException($"QRZ session error: {sessionError}");

        var callEl = doc.Root?.Element(Ns + "Callsign");
        if (callEl == null) return null;  // callsign not found

        string? Get(string name) => callEl.Element(Ns + name)?.Value;

        int? dxcc = int.TryParse(Get("dxcc"), out var d) ? d : null;
        var dto = new QrzCallsignDto(
            Callsign: Get("call") ?? callsign.ToUpperInvariant(),
            Name: $"{Get("fname")} {Get("name")}".Trim().NullIfEmpty(),
            Country: Get("country"),
            Grid: Get("grid"),
            Dxcc: dxcc,
            QslVia: Get("qslmgr"),
            ImageUrl: Get("image"),
            Email: Get("email")
        );

        _cache.Set(cacheKey, dto, TimeSpan.FromHours(24));
        return dto;
    }

    public async Task<IReadOnlyList<AdifQso>> FetchLogAsync(string apiKey, CancellationToken ct)
    {
        var content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["KEY"] = apiKey,
            ["ACTION"] = "FETCH",
            ["OPTION"] = "ALL"
        });
        var response = await _http.PostAsync("https://logbook.qrz.com/api", content, ct);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadAsStringAsync(ct);

        // QRZ returns RESULT=AUTH for bad keys, RESULT=FAIL for other errors.
        // A successful FETCH returns RESULT=OK&COUNT=N&ADIF=<raw adif> or just raw ADIF.
        if (body.Contains("RESULT=") && !body.Contains("RESULT=OK"))
        {
            var parts = ParseKvp(body);
            var reason = parts.GetValueOrDefault("REASON", "QRZ API fejl");
            var resultCode = parts.GetValueOrDefault("RESULT", "");
            throw new QrzApiException(resultCode == "AUTH"
                ? $"Ugyldig QRZ logbook API nøgle: {reason}"
                : reason);
        }

        // Extract ADIF from KVP envelope if present (RESULT=OK&COUNT=N&ADIF=<raw>)
        string adif = body;
        if (body.StartsWith("RESULT=", StringComparison.OrdinalIgnoreCase))
        {
            var adifIdx = body.IndexOf("&ADIF=", StringComparison.OrdinalIgnoreCase);
            adif = adifIdx >= 0 ? body[(adifIdx + 6)..] : string.Empty;
        }

        // QRZ HTML-encodes the ADIF in the response body
        adif = System.Net.WebUtility.HtmlDecode(adif);

        _logger.LogInformation("QRZ fetch: body={Len}, ADIF={AdifLen}, preview={Preview}",
            body.Length, adif.Length, adif.Length > 100 ? adif[..100] : adif);

        return ParseAdif(adif);
    }

    public async Task<string> UploadQsoAsync(AdifQso qso, string apiKey, CancellationToken ct)
    {
        var adif = BuildAdif(qso);
        var content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["KEY"] = apiKey,
            ["ACTION"] = "INSERT",
            ["ADIF"] = adif
        });
        var response = await _http.PostAsync("https://logbook.qrz.com/api", content, ct);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadAsStringAsync(ct);
        var parts = ParseKvp(body);
        if (parts.GetValueOrDefault("RESULT") != "OK")
            throw new QrzApiException(parts.GetValueOrDefault("REASON", "QRZ upload failed"));
        if (!parts.TryGetValue("LOGID", out var logId))
            throw new QrzApiException("No LOGID in QRZ response");
        return logId;
    }

    public async Task DeleteQsoAsync(string qrzId, string apiKey, CancellationToken ct)
    {
        var content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["KEY"] = apiKey,
            ["ACTION"] = "DELETE",
            ["LOGIDS"] = qrzId
        });
        var response = await _http.PostAsync("https://logbook.qrz.com/api", content, ct);
        response.EnsureSuccessStatusCode();
    }

    // ── ADIF helpers ──────────────────────────────────────────────────────────

    private static IReadOnlyList<AdifQso> ParseAdif(string adif)
    {
        var result = new List<AdifQso>();
        var records = System.Text.RegularExpressions.Regex.Split(adif, "<eor>", System.Text.RegularExpressions.RegexOptions.IgnoreCase)
            .Select(r => r.Trim()).Where(r => r.Length > 0).ToArray();
        foreach (var rec in records)
        {
            var call = GetField(rec, "CALL");
            var dateStr = GetField(rec, "QSO_DATE");
            var timeStr = GetField(rec, "TIME_ON") ?? "0000";
            var band = GetField(rec, "BAND");
            var mode = GetField(rec, "MODE");
            if (call == null || dateStr == null || band == null || mode == null) continue;
            if (!DateTime.TryParseExact(dateStr + timeStr.PadRight(6, '0')[..6],
                "yyyyMMddHHmmss",
                System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.AssumeUniversal | System.Globalization.DateTimeStyles.AdjustToUniversal,
                out var dt))
                continue;
            result.Add(new AdifQso(
                Call: call.ToUpperInvariant(),
                TimeOn: dt,
                Band: band.ToUpperInvariant(),
                Mode: mode.ToUpperInvariant(),
                RstSent: GetField(rec, "RST_SENT"),
                RstReceived: GetField(rec, "RST_RCVD"),
                Submode: GetField(rec, "SUBMODE"),
                Gridsquare: GetField(rec, "GRIDSQUARE"),
                MyGridsquare: GetField(rec, "MY_GRIDSQUARE"),
                Country: GetField(rec, "COUNTRY"),
                Dxcc: int.TryParse(GetField(rec, "DXCC"), out var dxccVal) ? dxccVal : null,
                Continent: GetField(rec, "CONT"),
                State: GetField(rec, "STATE"),
                County: NormalizeAwardText(GetField(rec, "CNTY")),
                Iota: GetField(rec, "IOTA"),
                PotaRefs: NormalizeAwardText(GetField(rec, "POTA_REF") ?? GetField(rec, "POTA_REFS")),
                SotaRefs: NormalizeAwardText(GetField(rec, "SOTA_REF") ?? GetField(rec, "SOTA_REFS")),
                AwardRefs: NormalizeAwardText(GetField(rec, "AWARD_SUBMITTED") ?? GetField(rec, "AWARD_GRANTED")),
                Name: GetField(rec, "NAME"),
                Qth: GetField(rec, "QTH"),
                TxPower: double.TryParse(GetField(rec, "TX_PWR"), System.Globalization.NumberStyles.Any,
                    System.Globalization.CultureInfo.InvariantCulture, out var pwrVal) ? pwrVal : null,
                Comment: GetField(rec, "COMMENT") ?? GetField(rec, "NOTES"),
                LogId: GetField(rec, "APP_QRZLOG_LOGID"),
                QrzStatus: GetField(rec, "APP_QRZLOG_STATUS"),
                QrzQslDate: ParseAdifDate(GetField(rec, "APP_QRZLOG_QSLDATE"))
            ));
        }
        return result;
    }

    private static DateTime? ParseAdifDate(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        return DateTime.TryParseExact(value, "yyyyMMdd", null, System.Globalization.DateTimeStyles.None, out var date)
            ? new DateTime(date.Year, date.Month, date.Day, 0, 0, 0, DateTimeKind.Utc)
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

    private static string BuildAdif(AdifQso qso)
    {
        static string F(string n, string v) => $"<{n}:{v.Length}>{v}";
        var sb = new System.Text.StringBuilder();
        sb.Append(F("CALL", qso.Call));
        sb.Append(F("QSO_DATE", qso.TimeOn.ToString("yyyyMMdd")));
        sb.Append(F("TIME_ON", qso.TimeOn.ToString("HHmm")));
        sb.Append(F("BAND", qso.Band));
        sb.Append(F("MODE", qso.Mode));
        if (!string.IsNullOrEmpty(qso.Submode)) sb.Append(F("SUBMODE", qso.Submode));
        if (!string.IsNullOrEmpty(qso.RstSent)) sb.Append(F("RST_SENT", qso.RstSent));
        if (!string.IsNullOrEmpty(qso.RstReceived)) sb.Append(F("RST_RCVD", qso.RstReceived));
        if (!string.IsNullOrEmpty(qso.Name)) sb.Append(F("NAME", qso.Name));
        if (!string.IsNullOrEmpty(qso.Qth)) sb.Append(F("QTH", qso.Qth));
        if (!string.IsNullOrEmpty(qso.Country)) sb.Append(F("COUNTRY", qso.Country));
        if (qso.Dxcc.HasValue) sb.Append(F("DXCC", qso.Dxcc.Value.ToString()));
        if (!string.IsNullOrEmpty(qso.Continent)) sb.Append(F("CONT", qso.Continent));
        if (!string.IsNullOrEmpty(qso.State)) sb.Append(F("STATE", qso.State));
        if (!string.IsNullOrEmpty(qso.County)) sb.Append(F("CNTY", qso.County));
        if (!string.IsNullOrEmpty(qso.Iota)) sb.Append(F("IOTA", qso.Iota));
        if (!string.IsNullOrEmpty(qso.PotaRefs)) sb.Append(F("POTA_REF", qso.PotaRefs));
        if (!string.IsNullOrEmpty(qso.SotaRefs)) sb.Append(F("SOTA_REF", qso.SotaRefs));
        if (!string.IsNullOrEmpty(qso.AwardRefs)) sb.Append(F("AWARD_SUBMITTED", qso.AwardRefs));
        if (!string.IsNullOrEmpty(qso.Gridsquare)) sb.Append(F("GRIDSQUARE", qso.Gridsquare));
        if (!string.IsNullOrEmpty(qso.MyGridsquare)) sb.Append(F("MY_GRIDSQUARE", qso.MyGridsquare));
        if (qso.TxPower.HasValue) sb.Append(F("TX_PWR", qso.TxPower.Value.ToString("F1", System.Globalization.CultureInfo.InvariantCulture)));
        if (!string.IsNullOrEmpty(qso.Comment)) sb.Append(F("COMMENT", qso.Comment));
        sb.Append("<EOR>");
        return sb.ToString();
    }

    private static Dictionary<string, string> ParseKvp(string body) =>
        body.Split('&')
            .Select(p => p.Split('=', 2))
            .Where(p => p.Length == 2)
            .ToDictionary(p => p[0], p => Uri.UnescapeDataString(p[1]));

    private static string? NormalizeAwardText(string? value)
    {
        var normalized = value?.Trim();
        return string.IsNullOrWhiteSpace(normalized) ? null : normalized.ToUpperInvariant();
    }
}

internal static class StringExtensions
{
    internal static string? NullIfEmpty(this string? s) =>
        string.IsNullOrWhiteSpace(s) ? null : s;
}
