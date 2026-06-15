using HamHub.Api.Services;
using Xunit;

namespace HamHub.Api.Tests;

public class DxClusterSpotParserTests
{
    [Fact]
    public void TryParseDxSpiderSpotExtractsSpotFields()
    {
        const string line = "DX de DM4IM:     50096.8  SV1CQN       JN49HN<>KM08QO cq              1210Z";

        var parsed = DxClusterSpotParser.TryParse(line, "OZ5BBS-7");

        Assert.NotNull(parsed);
        Assert.Equal("SV1CQN", parsed.Callsign);
        Assert.Equal(50096.8, parsed.FrequencyKhz);
        Assert.Equal("DM4IM", parsed.Spotter);
        Assert.Equal("JN49HN<>KM08QO cq", parsed.Info);
        Assert.Equal("1210Z", parsed.Time);
        Assert.Equal("OZ5BBS-7", parsed.Source);
    }

    [Fact]
    public void TryParseIgnoresNonSpotLines()
    {
        var parsed = DxClusterSpotParser.TryParse("OZ1ADM de OZ5BBS-7 15-Jun-2026 1210Z dxspider >", "OZ5BBS-7");

        Assert.Null(parsed);
    }
}
