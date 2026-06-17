using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using HamHub.WsjtxCore.Models;
using Microsoft.Extensions.Logging;

namespace HamHub.WsjtxCore;

public class HamHubApiClient
{
    private readonly HttpClient _http;
    private readonly HamHubConfig _config;
    private readonly ILogger<HamHubApiClient> _logger;
    private string? _token;

    public HamHubApiClient(HttpClient http, HamHubConfig config, ILogger<HamHubApiClient> logger)
    {
        _http = http;
        _config = config;
        _logger = logger;
        if (!string.IsNullOrWhiteSpace(config.ServerUrl))
            _http.BaseAddress = new Uri(config.ServerUrl);
    }

    public async Task LoginAsync(CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(_config.ServerUrl))
            throw new InvalidOperationException("HamHub ServerUrl is not configured.");
        if (_http.BaseAddress is null)
            throw new InvalidOperationException("HttpClient BaseAddress was not set in constructor. This should not happen if ServerUrl was configured.");
        var body = new { email = _config.Username, password = _config.Password };
        var res = await _http.PostAsJsonAsync("/api/auth/login", body, ct);
        res.EnsureSuccessStatusCode();
        var json = await res.Content.ReadFromJsonAsync<JsonElement>(ct);
        _token = json.GetProperty("token").GetString()
            ?? throw new InvalidOperationException("No token in login response");
        _logger.LogInformation("Logged in to HamHub as {Username}", _config.Username);
    }

    public async Task PostDecodesAsync(WsjtxDecodeDto[] decodes, CancellationToken ct = default)
    {
        await SendWithRetryAsync(() => BuildRequest(HttpMethod.Post, "/api/wsjtx/decodes", decodes), ct);
    }

    public async Task PostQsoAsync(WsjtxQsoDto qso, CancellationToken ct = default)
    {
        var body = new
        {
            dateUtc = qso.DateUtc,
            ownCallsign = qso.OwnCallsign,
            workedCallsign = qso.WorkedCallsign,
            frequency = qso.FrequencyMhz,
            band = MapBand(qso.FrequencyMhz),
            mode = MapMode(qso.Mode),
            rstSent = qso.RstSent,
            rstReceived = qso.RstReceived,
            locator = qso.Locator,
            comment = qso.Notes
        };
        await SendWithRetryAsync(() => BuildRequest(HttpMethod.Post, "/api/qsos", body), ct);
    }

    public async Task PostStatusAsync(WsjtxStatusDto status, CancellationToken ct = default)
    {
        await SendWithRetryAsync(() => BuildRequest(HttpMethod.Post, "/api/wsjtx/status", status), ct);
    }

    public async Task<TimeSpan?> GetServerClockOffsetAsync(CancellationToken ct = default)
    {
        var before = DateTime.UtcNow;
        var res = await _http.SendAsync(BuildRequest(HttpMethod.Get, "/api/wsjtx/time"), ct);
        var after = DateTime.UtcNow;

        if (res.StatusCode == System.Net.HttpStatusCode.Unauthorized)
        {
            _logger.LogWarning("Got 401 while checking server time, re-logging in...");
            await LoginAsync(ct);
            before = DateTime.UtcNow;
            res = await _http.SendAsync(BuildRequest(HttpMethod.Get, "/api/wsjtx/time"), ct);
            after = DateTime.UtcNow;
        }

        if (!res.IsSuccessStatusCode)
        {
            var err = await res.Content.ReadAsStringAsync(ct);
            _logger.LogWarning("Server time check failed {Status}: {Body}", (int)res.StatusCode, err);
            return null;
        }

        var json = await res.Content.ReadFromJsonAsync<JsonElement>(ct);
        var serverTimeUtc = json.GetProperty("serverTimeUtc").GetDateTime();
        var localMidpointUtc = before + TimeSpan.FromTicks((after - before).Ticks / 2);
        return serverTimeUtc - localMidpointUtc;
    }

    public async Task CheckServerClockSkewAsync(ILogger logger, CancellationToken ct = default)
    {
        var offset = await GetServerClockOffsetAsync(ct);
        if (offset is null) return;

        var absoluteOffset = offset.Value.Duration();
        if (absoluteOffset > TimeSpan.FromSeconds(5))
        {
            logger.LogWarning(
                "Computer clock differs from HamHub server by {OffsetSeconds:N1}s. Enable automatic time sync to keep WSJT-X timestamps reliable.",
                offset.Value.TotalSeconds);
        }
        else
        {
            logger.LogInformation("Computer clock is in sync with HamHub server ({OffsetSeconds:N1}s offset).", offset.Value.TotalSeconds);
        }
    }

    public async Task<WsjtxAgentCommand?> GetNextCommandAsync(CancellationToken ct = default)
    {
        var res = await _http.SendAsync(BuildRequest(HttpMethod.Get, "/api/wsjtx/commands/next"), ct);
        if (res.StatusCode == System.Net.HttpStatusCode.Unauthorized)
        {
            _logger.LogWarning("Got 401 while polling commands, re-logging in...");
            await LoginAsync(ct);
            res = await _http.SendAsync(BuildRequest(HttpMethod.Get, "/api/wsjtx/commands/next"), ct);
        }
        if (res.StatusCode == System.Net.HttpStatusCode.NoContent) return null;
        if (!res.IsSuccessStatusCode)
        {
            var err = await res.Content.ReadAsStringAsync(ct);
            _logger.LogError("Command poll error {Status}: {Body}", (int)res.StatusCode, err);
            return null;
        }
        return await res.Content.ReadFromJsonAsync<WsjtxAgentCommand>(ct);
    }

    public async Task CompleteCommandAsync(Guid id, WsjtxCommandType type, bool success, string message, CancellationToken ct = default)
    {
        await SendWithRetryAsync(
            () => BuildRequest(HttpMethod.Post, $"/api/wsjtx/commands/{id}/result", new { type, success, message }),
            ct);
    }

    private HttpRequestMessage BuildRequest<T>(HttpMethod method, string path, T body)
    {
        var req = new HttpRequestMessage(method, path);
        req.Content = new StringContent(
            JsonSerializer.Serialize(body),
            Encoding.UTF8,
            "application/json");
        if (_token != null)
            req.Headers.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _token);
        return req;
    }

    private HttpRequestMessage BuildRequest(HttpMethod method, string path)
    {
        var req = new HttpRequestMessage(method, path);
        if (_token != null)
            req.Headers.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _token);
        return req;
    }

    private async Task SendWithRetryAsync(Func<HttpRequestMessage> buildReq, CancellationToken ct)
    {
        var res = await _http.SendAsync(buildReq(), ct);
        if (res.StatusCode == System.Net.HttpStatusCode.Unauthorized)
        {
            _logger.LogWarning("Got 401, re-logging in...");
            await LoginAsync(ct);
            res = await _http.SendAsync(buildReq(), ct);
        }
        if (!res.IsSuccessStatusCode)
        {
            var err = await res.Content.ReadAsStringAsync(ct);
            _logger.LogError("API error {Status}: {Body}", (int)res.StatusCode, err);
        }
    }

    private static int MapMode(string mode) => mode.ToUpperInvariant() switch
    {
        "FT8"  => 3,
        "FT4"  => 4,
        "CW"   => 2,
        "SSB"  => 1,
        "RTTY" => 5,
        "FM"   => 7,
        "AM"   => 8,
        _      => 3
    };

    private static int MapBand(double frequencyMhz) => frequencyMhz switch
    {
        >= 1.8 and <= 2.0 => 1,
        >= 3.5 and <= 4.0 => 2,
        >= 5.0 and <= 5.5 => 3,
        >= 7.0 and <= 7.3 => 4,
        >= 10.1 and <= 10.15 => 5,
        >= 14.0 and <= 14.35 => 6,
        >= 18.068 and <= 18.168 => 7,
        >= 21.0 and <= 21.45 => 8,
        >= 24.89 and <= 24.99 => 9,
        >= 28.0 and <= 29.7 => 10,
        >= 50.0 and <= 54.0 => 11,
        >= 144.0 and <= 148.0 => 12,
        >= 420.0 and <= 450.0 => 13,
        _ => 6
    };
}
