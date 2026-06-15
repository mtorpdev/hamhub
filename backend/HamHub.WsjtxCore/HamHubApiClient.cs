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
            mode = MapMode(qso.Mode),
            rstSent = qso.RstSent,
            rstReceived = qso.RstReceived,
            locator = qso.Locator,
            notes = qso.Notes
        };
        await SendWithRetryAsync(() => BuildRequest(HttpMethod.Post, "/api/qsos", body), ct);
    }

    public async Task PostStatusAsync(WsjtxStatusDto status, CancellationToken ct = default)
    {
        await SendWithRetryAsync(() => BuildRequest(HttpMethod.Post, "/api/wsjtx/status", status), ct);
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
}
