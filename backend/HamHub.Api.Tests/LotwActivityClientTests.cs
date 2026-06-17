using HamHub.Infrastructure.Services;
using Xunit;

namespace HamHub.Api.Tests;

public class LotwActivityClientTests
{
    [Fact]
    public void ParseActivityCsvStoresLastUploadDateByCallsign()
    {
        var csv = """
            callsign,last upload
            OZ1ABC,2026-06-15
            k1xyz,2026-05-01
            BROKEN,
            """;

        var activity = LotwActivityClient.ParseActivityCsv(csv);

        Assert.Equal(new DateOnly(2026, 6, 15), activity["OZ1ABC"]);
        Assert.Equal(new DateOnly(2026, 5, 1), activity["K1XYZ"]);
        Assert.False(activity.ContainsKey("BROKEN"));
    }
}
