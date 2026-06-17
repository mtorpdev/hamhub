using System.Text.Json;
using HamHub.WsjtxCore;
using HamHub.WsjtxCore.Models;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace HamHub.Api.Tests;

public class HamHubApiClientTests
{
    [Fact]
    public async Task PostQsoSendsBandInferredFromFrequencyAndComment()
    {
        string? body = null;
        var client = new HamHubApiClient(
            new HttpClient(new CapturingHandler(request =>
            {
                body = request.Content?.ReadAsStringAsync().GetAwaiter().GetResult();
                return new HttpResponseMessage(System.Net.HttpStatusCode.OK);
            })),
            new HamHubConfig { ServerUrl = "https://api.example.test" },
            NullLogger<HamHubApiClient>.Instance);

        await client.PostQsoAsync(new WsjtxQsoDto(
            DateUtc: new DateTime(2026, 6, 17, 9, 35, 0, DateTimeKind.Utc),
            OwnCallsign: "OZ4MT",
            WorkedCallsign: "SP6SOZ",
            FrequencyMhz: 14.075562,
            Mode: "FT8",
            RstSent: "-13",
            RstReceived: "-05",
            Locator: "JO80",
            Notes: "auto logged"));

        using var json = JsonDocument.Parse(body!);
        Assert.Equal(6, json.RootElement.GetProperty("band").GetInt32());
        Assert.Equal("auto logged", json.RootElement.GetProperty("comment").GetString());
        Assert.False(json.RootElement.TryGetProperty("notes", out _));
    }

    private sealed class CapturingHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, HttpResponseMessage> _handle;

        public CapturingHandler(Func<HttpRequestMessage, HttpResponseMessage> handle)
        {
            _handle = handle;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(_handle(request));
    }
}
