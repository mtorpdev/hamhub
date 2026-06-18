using HamHub.Api.Services;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace HamHub.Api.Tests;

public class PotaClientTests
{
    [Fact]
    public async Task GetActiveSpotsParsesPublicPotaSpotFeed()
    {
        HttpRequestMessage? capturedRequest = null;
        var client = CreateClient(request =>
        {
            capturedRequest = request;
            return new HttpResponseMessage(System.Net.HttpStatusCode.OK)
            {
                Content = new StringContent("""
                    [
                      {
                        "spotId": 52079449,
                        "spotTime": "2026-06-18T05:19:47",
                        "activator": "JR5JAQ/P",
                        "frequency": "7048",
                        "mode": "FT4",
                        "reference": "JP-1667",
                        "spotter": "JF1AWC",
                        "source": "GT",
                        "comments": "FT4 Sent: -09",
                        "name": "Yokogurayama Prefectural Nature Park",
                        "locationDesc": "JP-KC",
                        "grid4": "PM64",
                        "grid6": "PM64ab",
                        "latitude": 33.5321,
                        "longitude": 133.1245,
                        "expire": 1632
                      }
                    ]
                    """)
            };
        });

        var spots = await client.GetActiveSpotsAsync(CancellationToken.None);

        var spot = Assert.Single(spots);
        Assert.Equal(52079449, spot.SpotId);
        Assert.Equal("JR5JAQ/P", spot.Activator);
        Assert.Equal("7048", spot.Frequency);
        Assert.Equal(7048, spot.FrequencyKhz);
        Assert.Equal("40m", spot.Band);
        Assert.Equal("FT4", spot.Mode);
        Assert.Equal("JP-1667", spot.Reference);
        Assert.Equal("Yokogurayama Prefectural Nature Park", spot.ParkName);
        Assert.Equal("JP-KC", spot.LocationDesc);
        Assert.Equal("PM64ab", spot.Grid6);
        Assert.Equal(33.5321, spot.Latitude);
        Assert.Equal(133.1245, spot.Longitude);
        Assert.Equal(new DateTime(2026, 6, 18, 5, 19, 47, DateTimeKind.Utc), spot.SpotTimeUtc);
        Assert.Equal("https://api.pota.app/spot/activator", capturedRequest?.RequestUri?.ToString());
    }

    [Fact]
    public async Task GetActiveSpotsCachesUpstreamResponse()
    {
        var calls = 0;
        var client = CreateClient(_ =>
        {
            calls++;
            return new HttpResponseMessage(System.Net.HttpStatusCode.OK)
            {
                Content = new StringContent("""[{ "spotId": 1, "spotTime": "2026-06-18T05:19:47", "activator": "OZ4MT/P", "frequency": "14074", "mode": "FT8", "reference": "DK-0001" }]""")
            };
        });

        await client.GetActiveSpotsAsync(CancellationToken.None);
        await client.GetActiveSpotsAsync(CancellationToken.None);

        Assert.Equal(1, calls);
    }

    private static PotaClient CreateClient(Func<HttpRequestMessage, HttpResponseMessage> handle) =>
        new(
            new HttpClient(new CapturingHandler(handle)),
            new MemoryCache(new MemoryCacheOptions()),
            NullLogger<PotaClient>.Instance);

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
