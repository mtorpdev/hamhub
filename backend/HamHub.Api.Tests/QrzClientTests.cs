using HamHub.Infrastructure.Services;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace HamHub.Api.Tests;

public class QrzClientTests
{
    [Fact]
    public async Task FetchLogParsesQrzConfirmationFields()
    {
        var adif = string.Concat(
            "<CALL:5>F5RRS",
            "<QSO_DATE:8>20260614",
            "<TIME_ON:4>1122",
            "<BAND:3>20M",
            "<MODE:3>FT8",
            "<DXCC:3>227",
            "<CONT:2>EU",
            "<STATE:2>75",
            "<CNTY:5>FR-75",
            "<IOTA:6>EU-032",
            "<POTA_REF:7>FR-0001",
            "<SOTA_REF:8>F/AB-001",
            "<AWARD_SUBMITTED:12>SPECIAL-2026",
            "<APP_QRZLOG_LOGID:9>123456789",
            "<APP_QRZLOG_STATUS:1>C",
            "<APP_QRZLOG_QSLDATE:8>20260616",
            "<EOR>");
        var body = $"RESULT=OK&COUNT=1&ADIF={System.Net.WebUtility.HtmlEncode(adif)}";
        var client = new QrzClient(
            new HttpClient(new CapturingHandler(_ => new HttpResponseMessage(System.Net.HttpStatusCode.OK)
            {
                Content = new StringContent(body)
            })),
            new MemoryCache(new MemoryCacheOptions()),
            NullLogger<QrzClient>.Instance);

        var qsos = await client.FetchLogAsync("logbook-key", CancellationToken.None);

        var qso = Assert.Single(qsos);
        Assert.Equal("123456789", qso.LogId);
        Assert.Equal("C", qso.QrzStatus);
        Assert.Equal(new DateTime(2026, 6, 16, 0, 0, 0, DateTimeKind.Utc), qso.QrzQslDate);
        Assert.Equal(227, qso.Dxcc);
        Assert.Equal("EU", qso.Continent);
        Assert.Equal("75", qso.State);
        Assert.Equal("FR-75", qso.County);
        Assert.Equal("EU-032", qso.Iota);
        Assert.Equal("FR-0001", qso.PotaRefs);
        Assert.Equal("F/AB-001", qso.SotaRefs);
        Assert.Equal("SPECIAL-2026", qso.AwardRefs);
    }

    [Fact]
    public async Task FetchLogParsesTimeOnAsUtcWithSeconds()
    {
        var adif = string.Concat(
            "<CALL:5>K1ABC",
            "<QSO_DATE:8>20260617",
            "<TIME_ON:6>120020",
            "<BAND:3>20M",
            "<MODE:3>FT8",
            "<APP_QRZLOG_LOGID:9>987654321",
            "<EOR>");
        var body = $"RESULT=OK&COUNT=1&ADIF={System.Net.WebUtility.HtmlEncode(adif)}";
        var client = new QrzClient(
            new HttpClient(new CapturingHandler(_ => new HttpResponseMessage(System.Net.HttpStatusCode.OK)
            {
                Content = new StringContent(body)
            })),
            new MemoryCache(new MemoryCacheOptions()),
            NullLogger<QrzClient>.Instance);

        var qsos = await client.FetchLogAsync("logbook-key", CancellationToken.None);

        var qso = Assert.Single(qsos);
        Assert.Equal(new DateTime(2026, 6, 17, 12, 0, 20, DateTimeKind.Utc), qso.TimeOn);
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
