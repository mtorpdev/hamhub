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

    [Theory]
    [InlineData("Warning: Y=2026 M=06 D=15 Bad record: Duplicate", "QSO findes allerede hos eQSL")]
    [InlineData("<html><body>Warning: Y=2026 M=06 D=15 Bad Record: Duplicate<br></body></html>", "QSO findes allerede hos eQSL")]
    public async Task UploadQsoTreatsDuplicateWarningAsSuccessful(string body, string expected)
    {
        var handler = new CapturingHandler(_ => new HttpResponseMessage(System.Net.HttpStatusCode.OK)
        {
            Content = new StringContent(body)
        });
        var client = new EqslClient(new HttpClient(handler));

        var result = await client.UploadQsoAsync(TestQso(), "OZ4MT", "secret", null, CancellationToken.None);

        Assert.True(result.Success);
        Assert.Contains(expected, result.Message);
    }

    [Theory]
    [InlineData("Error: No match on eQSL_User/eQSL_Pswd", "eQSL login blev afvist")]
    [InlineData("Error: No match on eQSL_User/eQSL_Pswd for date 20260615 12:00", "QSO dato/tid passer ikke med en eQSL QTH-profil")]
    [InlineData("Error: Multiple accounts match eQSL_User/eQSL_Pswd for date 20260615 12:00", "Flere eQSL QTH-profiler matcher")]
    [InlineData("Warning: Y=2026 M=06 D=15 Bad Mode: NOTAMODE", "eQSL afviste mode")]
    [InlineData("Warning: Y=2026 M=06 D=15 Bad Band/Freq: 99M", "eQSL afviste band/frekvens")]
    public async Task UploadQsoReturnsFriendlyEqslErrors(string body, string expected)
    {
        var handler = new CapturingHandler(_ => new HttpResponseMessage(System.Net.HttpStatusCode.OK)
        {
            Content = new StringContent(body)
        });
        var client = new EqslClient(new HttpClient(handler));

        var ex = await Assert.ThrowsAsync<EqslApiException>(() =>
            client.UploadQsoAsync(TestQso(), "OZ4MT", "secret", null, CancellationToken.None));

        Assert.Contains(expected, ex.Message);
    }

    [Fact]
    public async Task UploadQsoAcceptsSuccessWithInformationLines()
    {
        var handler = new CapturingHandler(_ => new HttpResponseMessage(System.Net.HttpStatusCode.OK)
        {
            Content = new StringContent("""
                Information: Received 250 bytes<br>
                Result: 1 out of 1 records added<br>
                Information: From: OZ4MT To: K1ABC Date: 20260615 Time: 1200 Band: 20M Mode: FT8 RST: -10<br>
                """)
        });
        var client = new EqslClient(new HttpClient(handler));

        var result = await client.UploadQsoAsync(TestQso(), "OZ4MT", "secret", null, CancellationToken.None);

        Assert.True(result.Success);
        Assert.Contains("Result: 1 out of 1 records added", result.Message);
    }

    [Fact]
    public async Task VerifyQsoReturnsOnFileWhenEqslHasMatch()
    {
        HttpRequestMessage? capturedRequest = null;
        var handler = new CapturingHandler(request =>
        {
            capturedRequest = request;
            return new HttpResponseMessage(System.Net.HttpStatusCode.OK)
            {
                Content = new StringContent("""
                    Result - QSO on file
                    Information - Authenticity Guaranteed
                    """)
            };
        });
        var client = new EqslClient(new HttpClient(handler));

        var result = await client.VerifyQsoAsync(TestVerificationQso(), CancellationToken.None);

        Assert.True(result.OnFile);
        Assert.True(result.AuthenticityGuaranteed);
        Assert.Contains("VerifyQSO.cfm", capturedRequest?.RequestUri?.ToString());
        Assert.Contains("CallsignFrom=OZ4MT", capturedRequest?.RequestUri?.ToString());
    }

    [Fact]
    public async Task VerifyQsoReturnsNotOnFileWhenEqslHasNoMatch()
    {
        var handler = new CapturingHandler(_ => new HttpResponseMessage(System.Net.HttpStatusCode.OK)
        {
            Content = new StringContent("Error - Result: QSO not on file")
        });
        var client = new EqslClient(new HttpClient(handler));

        var result = await client.VerifyQsoAsync(TestVerificationQso(), CancellationToken.None);

        Assert.False(result.OnFile);
        Assert.Contains("ikke fundet", result.Message);
    }

    [Theory]
    [InlineData("Error - CallsignFrom not on file", "Afsender-kaldesignalet er ikke registreret")]
    [InlineData("Error - CallsignTo not on file", "Modpartens kaldesignal er ikke registreret")]
    [InlineData("Information - CallsignTo not on file", "Modpartens kaldesignal er ikke registreret")]
    public async Task VerifyQsoReturnsFriendlyNotOnFileMessages(string body, string expected)
    {
        var handler = new CapturingHandler(_ => new HttpResponseMessage(System.Net.HttpStatusCode.OK)
        {
            Content = new StringContent(body)
        });
        var client = new EqslClient(new HttpClient(handler));

        var result = await client.VerifyQsoAsync(TestVerificationQso(), CancellationToken.None);

        Assert.False(result.OnFile);
        Assert.Contains(expected, result.Message);
    }

    private static EqslAdifQso TestQso() => new(
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

    private static EqslVerificationQso TestVerificationQso() => new(
        CallsignFrom: "OZ4MT",
        CallsignTo: "OZ1ABC",
        DateUtc: new DateTime(2026, 6, 15, 12, 0, 0, DateTimeKind.Utc),
        Band: "20M",
        Mode: "FT8");

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
