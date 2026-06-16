using System.Globalization;
using System.Text.RegularExpressions;

namespace HamHub.Infrastructure.Services;

public class EqslApiException(string message) : Exception(message);

public record EqslUploadResult(bool Success, string Message);
public record EqslVerificationResult(bool OnFile, bool AuthenticityGuaranteed, string Message);

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

        var errorLine = FirstResultLine(text, "Error:");
        if (errorLine != null)
            throw new EqslApiException(FriendlyMessage(errorLine));

        var resultLine = FirstResultLine(text, "Result:");
        if (resultLine != null && IsSuccessfulResult(resultLine))
            return new EqslUploadResult(true, resultLine);

        var warningLine = FirstResultLine(text, "Warning:");
        if (warningLine != null && warningLine.Contains("Bad record: Duplicate", StringComparison.OrdinalIgnoreCase))
            return new EqslUploadResult(true, $"QSO findes allerede hos eQSL. {warningLine}");

        if (warningLine != null)
            throw new EqslApiException(FriendlyMessage(warningLine));

        var preview = Preview(text);
        if (string.IsNullOrWhiteSpace(preview)) preview = Preview(body);
        throw new EqslApiException($"eQSL returnerede et ukendt svar ({body.Length} tegn): {preview}");
    }

    public async Task<EqslVerificationResult> VerifyQsoAsync(EqslVerificationQso qso, CancellationToken ct)
    {
        var query = new Dictionary<string, string>
        {
            ["CallsignFrom"] = qso.CallsignFrom,
            ["CallsignTo"] = qso.CallsignTo,
            ["QSOBand"] = qso.Band,
            ["QSOYear"] = qso.DateUtc.Year.ToString(CultureInfo.InvariantCulture),
            ["QSOMonth"] = qso.DateUtc.Month.ToString(CultureInfo.InvariantCulture),
            ["QSODay"] = qso.DateUtc.Day.ToString(CultureInfo.InvariantCulture),
            ["QSOMode"] = qso.Mode
        }
            .Where(kvp => !string.IsNullOrWhiteSpace(kvp.Value))
            .Select(kvp => $"{Uri.EscapeDataString(kvp.Key)}={Uri.EscapeDataString(kvp.Value)}");

        using var request = new HttpRequestMessage(HttpMethod.Get, $"https://www.eQSL.cc/qslcard/VerifyQSO.cfm?{string.Join("&", query)}");
        request.Headers.UserAgent.ParseAdd("HamHub/1.0");
        var response = await _http.SendAsync(request, ct);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadAsStringAsync(ct);
        var text = StripHtml(body);
        var normalized = Regex.Replace(text, @"\s+", " ").Trim();

        if (normalized.Contains("Result - QSO on file", StringComparison.OrdinalIgnoreCase))
        {
            var ag = normalized.Contains("Information - Authenticity Guaranteed", StringComparison.OrdinalIgnoreCase);
            return new EqslVerificationResult(true, ag, ag ? "QSO fundet på eQSL med Authenticity Guaranteed." : "QSO fundet på eQSL.");
        }

        if (normalized.Contains("Error - Result: QSO not on file", StringComparison.OrdinalIgnoreCase))
            return new EqslVerificationResult(false, false, "QSO ikke fundet på eQSL endnu.");

        if (normalized.Contains("Error - Result: QSO rejected by recipient", StringComparison.OrdinalIgnoreCase))
            return new EqslVerificationResult(false, false, "QSO er afvist af modtageren på eQSL.");

        if (normalized.Contains("Information - CallsignTo not on file", StringComparison.OrdinalIgnoreCase))
            return new EqslVerificationResult(false, false, "Modpartens kaldesignal er ikke registreret hos eQSL.");

        var errorLine = FirstResultLine(text, "Error -");
        if (errorLine != null)
            throw new EqslApiException(errorLine);

        throw new EqslApiException($"eQSL VerifyQSO returnerede et ukendt svar: {Preview(text)}");
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

    private static bool IsSuccessfulResult(string line)
    {
        var match = Regex.Match(line, @"Result:\s*(\d+)\s+out\s+of\s+(\d+)\s+records?\s+added", RegexOptions.IgnoreCase);
        if (!match.Success) return false;
        return int.TryParse(match.Groups[1].Value, out var added)
            && int.TryParse(match.Groups[2].Value, out var total)
            && total > 0
            && added == total;
    }

    private static string FriendlyMessage(string line)
    {
        var normalized = Regex.Replace(line, @"\s+", " ").Trim();

        if (normalized.Contains("No match on eQSL_User/eQSL_Pswd for date", StringComparison.OrdinalIgnoreCase))
            return $"QSO dato/tid passer ikke med en eQSL QTH-profil. Tjek QTH nickname og datoerne på eQSL.cc. ({normalized})";
        if (normalized.Contains("Multiple accounts match eQSL_User/eQSL_Pswd for date", StringComparison.OrdinalIgnoreCase))
            return $"Flere eQSL QTH-profiler matcher denne QSO. Angiv QTH nickname på profilen. ({normalized})";
        if (normalized.Contains("No match on eQSL_User/eQSL_Pswd", StringComparison.OrdinalIgnoreCase))
            return $"eQSL login blev afvist. Tjek brugernavn og adgangskode. ({normalized})";
        if (normalized.Contains("Bad QSO Date", StringComparison.OrdinalIgnoreCase))
            return $"eQSL afviste QSO-datoen. ({normalized})";
        if (normalized.Contains("Bad QSO Time", StringComparison.OrdinalIgnoreCase))
            return $"eQSL afviste QSO-tidspunktet. ({normalized})";
        if (normalized.Contains("Bad Callsign", StringComparison.OrdinalIgnoreCase))
            return $"eQSL afviste kaldesignalet. ({normalized})";
        if (normalized.Contains("Bad Mode", StringComparison.OrdinalIgnoreCase))
            return $"eQSL afviste mode. Tjek mode/submode på QSO'en. ({normalized})";
        if (normalized.Contains("Bad Band/Freq", StringComparison.OrdinalIgnoreCase))
            return $"eQSL afviste band/frekvens. Tjek band og frekvens på QSO'en. ({normalized})";
        if (normalized.Contains("QSO Date/Time in Future", StringComparison.OrdinalIgnoreCase))
            return $"eQSL afviste QSO'en fordi dato/tid ligger i fremtiden. ({normalized})";
        if (normalized.Contains("system is down", StringComparison.OrdinalIgnoreCase))
            return $"eQSL melder vedligehold eller nedetid. Prøv igen senere. ({normalized})";

        return normalized;
    }

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

public record EqslVerificationQso(
    string CallsignFrom,
    string CallsignTo,
    DateTime DateUtc,
    string Band,
    string Mode);
