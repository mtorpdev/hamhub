using HamHub.Infrastructure.Services;
using Xunit;

namespace HamHub.Api.Tests;

public class EqslClientLiveTests
{
    [Fact(Skip = "Manual live check against eQSL public test credentials.")]
    public async Task UploadQsoWithPublicEqslTestAccountReturnsResult()
    {
        var client = new EqslClient(new HttpClient());
        var qso = new EqslAdifQso(
            Call: "WB4WXX",
            TimeOn: DateTime.UtcNow.AddMinutes(-5),
            Band: "20M",
            Mode: "SSB",
            FrequencyMhz: null,
            RstSent: "59",
            RstReceived: "59",
            Submode: null,
            Gridsquare: null,
            Comment: null);

        var result = await client.UploadQsoAsync(qso, "TEST-SWL", "Testpswd1", null, CancellationToken.None);

        Assert.True(result.Success);
    }
}
