using HamHub.Infrastructure.Services;
using Xunit;

namespace HamHub.Api.Tests;

public class EqslClientTests
{
    [Fact]
    public async Task UploadQsoPostsAdifDataInFormBody()
    {
        HttpRequestMessage? capturedRequest = null;
        string? capturedBody = null;
        var handler = new CapturingHandler(request =>
        {
            capturedRequest = request;
            capturedBody = request.Content?.ReadAsStringAsync().GetAwaiter().GetResult();
            return new HttpResponseMessage(System.Net.HttpStatusCode.OK)
            {
                Content = new StringContent("Result: 1 out of 1 records added")
            };
        });
        var client = new EqslClient(new HttpClient(handler));
        var qso = new EqslAdifQso(
            Call: "OZ1ABC",
            TimeOn: new DateTime(2026, 6, 15, 12, 0, 0, DateTimeKind.Utc),
            Band: "20M",
            Mode: "FT8",
            FrequencyMhz: 14.074,
            RstSent: "-10",
            RstReceived: "-08",
            Submode: null,
            Gridsquare: "JO65",
            Comment: null);

        await client.UploadQsoAsync(qso, "OZ4MT", "secret", null, CancellationToken.None);

        Assert.NotNull(capturedRequest);
        Assert.Equal("application/x-www-form-urlencoded", capturedRequest.Content?.Headers.ContentType?.MediaType);
        Assert.NotNull(capturedRequest.RequestUri);
        Assert.DoesNotContain("EQSL_PSWD", capturedRequest.RequestUri!.ToString());
        Assert.Contains("ADIFData=", capturedBody);
        Assert.Contains("EQSL_USER=", capturedBody);
        Assert.Contains("EQSL_PSWD=", capturedBody);
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
