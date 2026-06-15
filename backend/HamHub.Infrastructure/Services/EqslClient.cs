using System.Globalization;
using System.Text.RegularExpressions;

namespace HamHub.Infrastructure.Services;

public class EqslApiException(string message) : Exception(message);

public record EqslUploadResult(bool Success, string Message);

public class EqslClient
{
    private readonly HttpClient _http;

    public EqslClient(HttpClient http)
    {
        _http = http;
    }

    public async Task VerifyCredentialsAsync(string username, string password, string? qthNickname, CancellationToken ct)
    {
        var url = BuildLastUploadUrl(username, password, qthNickname);
        var response = await _http.GetAsync(url, ct);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadAsStringAsync(ct);
        if (body.Contains("Error:", StringComparison.OrdinalIgnoreCase))
            throw new EqslApiException(StripHtml(body).Trim().NullIfEmpty() ?? "eQSL login fejlede");
    }

    public async Task<EqslUploadResult> UploadQsoAsync(EqslAdifQso qso, string username, string password, string? qthNickname, CancellationToken ct)
    {
        var adif = BuildAdif(qso, qthNickname);
        using var content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["ADIFData"] = adif,
            ["EQSL_USER"] = username,
            ["EQSL_PSWD"] = password
        });
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://www.eQSL.cc/qslcard/ImportADIF.cfm") { Content = content };
        request.Headers.UserAgent.ParseAdd("HamHub/1.0");
        var response = await _http.SendAsync(request, ct);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadAsStringAsync(ct);
        var text = StripHtml(body);

        if (text.Contains("Error:", StringComparison.OrdinalIgnoreCase))
            throw new EqslApiException(FirstResultLine(text, "Error:") ?? "eQSL upload fejlede");

        if (text.Contains("Result: 1 out of 1 records added", StringComparison.OrdinalIgnoreCase))
            return new EqslUploadResult(true, FirstResultLine(text, "Result:") ?? "QSO sendt til eQSL");

        if (text.Contains("Bad record: Duplicate", StringComparison.OrdinalIgnoreCase))
            return new EqslUploadResult(true, FirstResultLine(text, "Warning:") ?? "QSO findes allerede hos eQSL");

        if (text.Contains("Warning:", StringComparison.OrdinalIgnoreCase))
            throw new EqslApiException(FirstResultLine(text, "Warning:") ?? "eQSL afviste QSO'en");

        var preview = Preview(text);
        if (string.IsNullOrWhiteSpace(preview)) preview = Preview(body);
        throw new EqslApiException($"eQSL returnerede et ukendt svar ({body.Length} tegn): {preview}");
    }

    private static string BuildLastUploadUrl(string username, string password, string? qthNickname)
    {
        var query = new Dictionary<string, string?>
        {
            ["UserName"] = username,
            ["Password"] = password,
            ["QTHNickname"] = qthNickname
        }
            .Where(kvp => !string.IsNullOrWhiteSpace(kvp.Value))
            .Select(kvp => $"{Uri.EscapeDataString(kvp.Key)}={Uri.EscapeDataString(kvp.Value!)}");

        return $"https://www.eQSL.cc/qslcard/DisplayLastUploadDate.cfm?{string.Join("&", query)}";
    }

    private static string BuildAdif(EqslAdifQso qso, string? qthNickname)
    {
        static string F(string n, string v) => $"<{n}:{v.Length}>{v}";
        var sb = new System.Text.StringBuilder();
        sb.AppendLine(F("ADIF_VER", "3.1.6"));
        sb.AppendLine(F("PROGRAMID", "HamHub"));
        sb.AppendLine("<EOH>");
        sb.Append(F("CALL", qso.Call));
        sb.Append(F("QSO_DATE", qso.TimeOn.ToString("yyyyMMdd", CultureInfo.InvariantCulture)));
        sb.Append(F("TIME_ON", qso.TimeOn.ToString("HHmm", CultureInfo.InvariantCulture)));
        sb.Append(F("BAND", qso.Band));
        sb.Append(F("MODE", qso.Mode));
        if (!string.IsNullOrWhiteSpace(qso.Submode)) sb.Append(F("SUBMODE", qso.Submode));
        if (qso.FrequencyMhz.HasValue) sb.Append(F("FREQ", qso.FrequencyMhz.Value.ToString("F3", CultureInfo.InvariantCulture)));
        if (!string.IsNullOrWhiteSpace(qso.RstSent)) sb.Append(F("RST_SENT", qso.RstSent));
        if (!string.IsNullOrWhiteSpace(qso.RstReceived)) sb.Append(F("RST_RCVD", qso.RstReceived));
        if (!string.IsNullOrWhiteSpace(qso.Gridsquare)) sb.Append(F("GRIDSQUARE", qso.Gridsquare));
        if (!string.IsNullOrWhiteSpace(qso.Comment)) sb.Append(F("QSLMSG", qso.Comment.Length > 240 ? qso.Comment[..240] : qso.Comment));
        if (!string.IsNullOrWhiteSpace(qthNickname)) sb.Append(F("APP_EQSL_QTH_NICKNAME", qthNickname));
        sb.Append("<EOR>");
        return sb.ToString();
    }

    private static string StripHtml(string value)
    {
        var withoutBreaks = Regex.Replace(value, @"<\s*br\s*/?\s*>", "\n", RegexOptions.IgnoreCase);
        return Regex.Replace(withoutBreaks, "<.*?>", " ").Replace("&nbsp;", " ");
    }

    private static string? FirstResultLine(string text, string prefix) =>
        text.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .FirstOrDefault(line => line.Contains(prefix, StringComparison.OrdinalIgnoreCase))
            ?.Trim();

    private static string Preview(string text)
    {
        var compact = Regex.Replace(text, @"\s+", " ").Trim();
        return compact.Length <= 500 ? compact : compact[..500];
    }
}

public record EqslAdifQso(
    string Call,
    DateTime TimeOn,
    string Band,
    string Mode,
    double? FrequencyMhz,
    string? RstSent,
    string? RstReceived,
    string? Submode,
    string? Gridsquare,
    string? Comment);
