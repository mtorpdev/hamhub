using HamHub.Api.Services;
using HamHub.Domain.Entities;
using HamHub.Domain.Enums;
using HamHub.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace HamHub.Api.Tests;

public class QsoAwardEnrichmentServiceTests
{
    [Fact]
    public async Task BackfillMissingAsyncEnrichesExistingQsosWithoutOverwritingExplicitValues()
    {
        await using var context = CreateContext();
        context.QsoEntries.AddRange(
            new QsoEntry
            {
                UserId = "user-1",
                OwnCallsign = "OZ1ME",
                WorkedCallsign = "OZ1AAA",
                DateUtc = new DateTime(2026, 6, 17, 12, 0, 0, DateTimeKind.Utc),
                Band = Band.M20,
                Mode = Mode.FT8
            },
            new QsoEntry
            {
                UserId = "user-1",
                OwnCallsign = "OZ1ME",
                WorkedCallsign = "OZ2BBB",
                DateUtc = new DateTime(2026, 6, 17, 12, 5, 0, DateTimeKind.Utc),
                Band = Band.M20,
                Mode = Mode.FT8,
                Country = "Manual Country",
                Dxcc = 999,
                Continent = "XX",
                CqZone = 1,
                ItuZone = 2
            });
        await context.SaveChangesAsync();
        using var cty = new TemporaryCtyDirectory("""
Denmark:                  14:  18:  EU:   56.00:   -10.00:    -1.0:  OZ:
    5P,5Q,OU,OV,OW,OX,OY,OZ;
""");
        var service = new QsoAwardEnrichmentService(context, cty.Lookup);

        var result = await service.BackfillMissingAsync();

        Assert.Equal(1, result.Scanned);
        Assert.Equal(1, result.Updated);

        var enriched = await context.QsoEntries.SingleAsync(qso => qso.WorkedCallsign == "OZ1AAA");
        Assert.Equal("Denmark", enriched.Country);
        Assert.Equal(221, enriched.Dxcc);
        Assert.Equal("EU", enriched.Continent);
        Assert.Equal(14, enriched.CqZone);
        Assert.Equal(18, enriched.ItuZone);

        var explicitQso = await context.QsoEntries.SingleAsync(qso => qso.WorkedCallsign == "OZ2BBB");
        Assert.Equal("Manual Country", explicitQso.Country);
        Assert.Equal(999, explicitQso.Dxcc);
        Assert.Equal("XX", explicitQso.Continent);
        Assert.Equal(1, explicitQso.CqZone);
        Assert.Equal(2, explicitQso.ItuZone);
    }

    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    private sealed class TemporaryCtyDirectory : IDisposable
    {
        private readonly string _path = Path.Combine(Path.GetTempPath(), $"hamhub-cty-{Guid.NewGuid():N}");

        public TemporaryCtyDirectory(string ctyContent)
        {
            Directory.CreateDirectory(Path.Combine(_path, "Data"));
            File.WriteAllText(Path.Combine(_path, "Data", "cty.dat"), ctyContent);
            File.WriteAllText(Path.Combine(_path, "Data", "dxcc-entity-codes.csv"), """
"Enumeration Name","Entity Code","Entity Name","Deleted","Import-only","Comments","ADIF Version","ADIF Status"
"DXCC_Entity_Code","221","DENMARK","","","","3.1.7","Released"
""");
            Lookup = new DxccLookupService(new TestWebHostEnvironment(_path), NullLogger<DxccLookupService>.Instance);
        }

        public DxccLookupService Lookup { get; }

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
        public IFileProvider WebRootFileProvider { get; set; } = null!;
        public string ContentRootPath { get; set; } = contentRootPath;
        public IFileProvider ContentRootFileProvider { get; set; } = null!;
    }
}
