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
    string? Gridsquare,
    string? Country,
    string? LogId
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

        // Check for error response (URL-encoded format)
        if (body.Contains("RESULT=FAIL"))
        {
            var parts = ParseKvp(body);
            throw new QrzApiException(parts.GetValueOrDefault("REASON", "QRZ fetch failed"));
        }

        return ParseAdif(body);
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
        var records = adif.Split("<EOR>", StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        foreach (var rec in records)
        {
            var call = GetField(rec, "CALL");
            var dateStr = GetField(rec, "QSO_DATE");
            var timeStr = GetField(rec, "TIME_ON") ?? "0000";
            var band = GetField(rec, "BAND");
            var mode = GetField(rec, "MODE");
            if (call == null || dateStr == null || band == null || mode == null) continue;
            if (!DateTime.TryParseExact(dateStr + timeStr.PadRight(6, '0')[..4],
                "yyyyMMddHHmm", null, System.Globalization.DateTimeStyles.AssumeUniversal, out var dt))
                continue;
            result.Add(new AdifQso(
                Call: call.ToUpperInvariant(),
                TimeOn: DateTime.SpecifyKind(dt, DateTimeKind.Utc),
                Band: band.ToUpperInvariant(),
                Mode: mode.ToUpperInvariant(),
                RstSent: GetField(rec, "RST_SENT"),
                RstReceived: GetField(rec, "RST_RCVD"),
                Gridsquare: GetField(rec, "GRIDSQUARE"),
                Country: GetField(rec, "COUNTRY"),
                LogId: GetField(rec, "APP_QRZLOG_LOGID")
            ));
        }
        return result;
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
        if (!string.IsNullOrEmpty(qso.RstSent)) sb.Append(F("RST_SENT", qso.RstSent));
        if (!string.IsNullOrEmpty(qso.RstReceived)) sb.Append(F("RST_RCVD", qso.RstReceived));
        if (!string.IsNullOrEmpty(qso.Gridsquare)) sb.Append(F("GRIDSQUARE", qso.Gridsquare));
        if (!string.IsNullOrEmpty(qso.Country)) sb.Append(F("COUNTRY", qso.Country));
        sb.Append("<EOR>");
        return sb.ToString();
    }

    private static Dictionary<string, string> ParseKvp(string body) =>
        body.Split('&')
            .Select(p => p.Split('=', 2))
            .Where(p => p.Length == 2)
            .ToDictionary(p => p[0], p => Uri.UnescapeDataString(p[1]));
}

internal static class StringExtensions
{
    internal static string? NullIfEmpty(this string? s) =>
        string.IsNullOrWhiteSpace(s) ? null : s;
}
