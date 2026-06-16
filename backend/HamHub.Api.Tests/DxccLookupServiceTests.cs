using HamHub.Api.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace HamHub.Api.Tests;

public class DxccLookupServiceTests
{
    [Fact]
    public void ParseReadsEntitiesAndAliasesFromCtyDat()
    {
        var entries = DxccLookupService.Parse(new[]
        {
            "Denmark:                  14:  18:  EU:   56.00:   -10.00:    -1.0:  OZ:",
            "    5P,5Q,OU,OV,OW,OX,OY,OZ;",
            "Fed. Rep. of Germany:     14:  28:  EU:   51.00:   -10.00:    -1.0:  DL:",
            "    DA,DB,DC,DD,DE,DF,DG,DH,DI,DJ,DK,DL,DM,DN,DO,DP,DQ,DR;",
        });

        Assert.Equal(2, entries.Count);
        Assert.Equal("Denmark", entries[0].Name);
        Assert.Equal("OZ", entries[0].PrimaryPrefix);
        Assert.Contains(entries[0].Aliases, alias => alias.Prefix == "5P");
        Assert.Contains(entries[1].Aliases, alias => alias.Prefix == "DL");
    }

    [Theory]
    [InlineData("OZ1ABC", "Denmark", "OZ", "OZ1", 14, 18)]
    [InlineData("5P5ABC", "Denmark", "5P", "5P5", 14, 18)]
    [InlineData("DL/OZ1ABC", "Fed. Rep. of Germany", "DL", "DL", 14, 28)]
    [InlineData("4U1ITU", "ITU HQ", "4U1ITU", "4U1", 14, 28)]
    public void LookupReturnsEntityZonesAndWpxPrefix(
        string callsign,
        string country,
        string matchedPrefix,
        string wpxPrefix,
        int cqZone,
        int ituZone)
    {
        using var directory = new TemporaryCtyDirectory("""
Denmark:                  14:  18:  EU:   56.00:   -10.00:    -1.0:  OZ:
    5P,5Q,OU,OV,OW,OX,OY,OZ;
Fed. Rep. of Germany:     14:  28:  EU:   51.00:   -10.00:    -1.0:  DL:
    DA,DB,DC,DD,DE,DF,DG,DH,DI,DJ,DK,DL,DM,DN,DO,DP,DQ,DR;
ITU HQ:                   14:  28:  EU:   46.17:    -6.05:    -1.0:  4U1ITU:
    =4U1ITU;
""");
        var service = new DxccLookupService(directory.Environment, NullLogger<DxccLookupService>.Instance);

        var result = service.Lookup(callsign);

        Assert.NotNull(result);
        Assert.Equal(country, result.Country);
        Assert.Equal("EU", result.Continent);
        Assert.Equal(matchedPrefix, result.MatchedPrefix);
        Assert.Equal(wpxPrefix, result.WpxPrefix);
        Assert.Equal(cqZone, result.CqZone);
        Assert.Equal(ituZone, result.ItuZone);
    }

    private sealed class TemporaryCtyDirectory : IDisposable
    {
        private readonly string _path = Path.Combine(Path.GetTempPath(), $"hamhub-cty-{Guid.NewGuid():N}");

        public TemporaryCtyDirectory(string ctyContent)
        {
            Directory.CreateDirectory(Path.Combine(_path, "Data"));
            File.WriteAllText(Path.Combine(_path, "Data", "cty.dat"), ctyContent);
            Environment = new TestWebHostEnvironment(_path);
        }

        public IWebHostEnvironment Environment { get; }

        public void Dispose()
        {
            if (Directory.Exists(_path)) Directory.Delete(_path, recursive: true);
        }
    }

    private sealed class TestWebHostEnvironment(string contentRootPath) : IWebHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Test";
        public string ApplicationName { get; set; } = "HamHub.Api.Tests";
        public string WebRootPath { get; set; } = contentRootPath;
        public Microsoft.Extensions.FileProviders.IFileProvider WebRootFileProvider { get; set; } = null!;
        public string ContentRootPath { get; set; } = contentRootPath;
        public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider { get; set; } = null!;
    }
}
