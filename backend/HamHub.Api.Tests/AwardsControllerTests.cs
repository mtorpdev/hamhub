using System.Security.Claims;
using HamHub.Api.Controllers;
using HamHub.Api.Services;
using HamHub.Api.Services.Awards;
using HamHub.Domain.Entities;
using HamHub.Domain.Enums;
using HamHub.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace HamHub.Api.Tests;

public class AwardsControllerTests
{
    [Fact]
    public void CatalogReturnsAwardDefinitions()
    {
        using var context = CreateContext();
        var controller = CreateController(context, "user-1");

        var result = controller.GetCatalog();

        var ok = Assert.IsType<OkObjectResult>(result);
        var catalog = Assert.IsAssignableFrom<IReadOnlyList<AwardCatalogItemDto>>(ok.Value);
        Assert.Contains(catalog, award => award.Id == "dxcc" && award.Status == "active");
        Assert.Contains(catalog, award => award.Id == "pota" && award.Status == "active");
    }

    [Fact]
    public async Task SummaryOnlyUsesAuthenticatedUsersQsos()
    {
        await using var context = CreateContext();
        context.QsoEntries.AddRange(
            Qso("user-1", "K1ABC", 291, confirmed: true),
            Qso("user-2", "JA1XYZ", 339, confirmed: true));
        await context.SaveChangesAsync();
        var controller = CreateController(context, "user-1");

        var result = await controller.GetSummary(new AwardQuery());

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<AwardSummaryResponse>(ok.Value);
        var dxcc = Assert.Single(response.Awards, award => award.Id == "dxcc");
        Assert.Equal(1, dxcc.WorkedCount);
        Assert.Contains(dxcc.Entities, entity => entity.Key == "291");
        Assert.DoesNotContain(dxcc.Entities, entity => entity.Key == "339");
    }

    [Fact]
    public async Task DetailReturnsNotFoundForUnknownAward()
    {
        await using var context = CreateContext();
        var controller = CreateController(context, "user-1");

        var result = await controller.GetDetail("missing-award", new AwardQuery());

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task BackfillOnlyEnrichesAuthenticatedUsersQsos()
    {
        await using var context = CreateContext();
        context.QsoEntries.AddRange(
            new QsoEntry
            {
                UserId = "user-1",
                OwnCallsign = "OZ1ME",
                WorkedCallsign = "OZ1AAA",
                DateUtc = new DateTime(2026, 6, 17, 10, 0, 0, DateTimeKind.Utc),
                Band = Band.M20,
                Mode = Mode.FT8
            },
            new QsoEntry
            {
                UserId = "user-2",
                OwnCallsign = "OZ2ME",
                WorkedCallsign = "OZ2BBB",
                DateUtc = new DateTime(2026, 6, 17, 10, 5, 0, DateTimeKind.Utc),
                Band = Band.M20,
                Mode = Mode.FT8
            });
        await context.SaveChangesAsync();
        using var cty = new TemporaryCtyDirectory("""
Denmark:                  14:  18:  EU:   56.00:   -10.00:    -1.0:  OZ:
    5P,5Q,OU,OV,OW,OX,OY,OZ;
""");
        var enrichment = new QsoAwardEnrichmentService(context, cty.Lookup);
        var controller = CreateController(context, "user-1", enrichment);

        var result = await controller.Backfill(new AwardBackfillRequest(DryRun: false));

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<QsoAwardBackfillResult>(ok.Value);
        Assert.Equal(1, response.Scanned);
        Assert.Equal(1, response.Updated);

        var enriched = await context.QsoEntries.SingleAsync(qso => qso.UserId == "user-1");
        Assert.Equal(221, enriched.Dxcc);
        Assert.Equal("EU", enriched.Continent);
        Assert.Equal(14, enriched.CqZone);
        Assert.Equal(18, enriched.ItuZone);

        var otherUser = await context.QsoEntries.SingleAsync(qso => qso.UserId == "user-2");
        Assert.Null(otherUser.Dxcc);
        Assert.Null(otherUser.Continent);
    }

    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    private static AwardsController CreateController(ApplicationDbContext context, string userId, QsoAwardEnrichmentService? enrichment = null)
    {
        enrichment ??= new QsoAwardEnrichmentService(context, new DxccLookupService(new EmptyWebHostEnvironment(), NullLogger<DxccLookupService>.Instance));
        var controller = new AwardsController(context, new AwardEngine(), enrichment);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(
                    new[] { new Claim(ClaimTypes.NameIdentifier, userId) },
                    authenticationType: "Test"))
            }
        };
        return controller;
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

    private sealed class EmptyWebHostEnvironment : IWebHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Test";
        public string ApplicationName { get; set; } = "HamHub.Api.Tests";
        public string WebRootPath { get; set; } = Path.GetTempPath();
        public IFileProvider WebRootFileProvider { get; set; } = null!;
        public string ContentRootPath { get; set; } = Path.GetTempPath();
        public IFileProvider ContentRootFileProvider { get; set; } = null!;
    }

    private static QsoEntry Qso(string userId, string callsign, int dxcc, bool confirmed)
    {
        return new QsoEntry
        {
            UserId = userId,
            OwnCallsign = "OZ1ME",
            WorkedCallsign = callsign,
            DateUtc = new DateTime(2026, 6, 17, 10, 0, 0, DateTimeKind.Utc),
            Band = Band.M20,
            Mode = Mode.FT8,
            Dxcc = dxcc,
            Country = callsign.StartsWith("K", StringComparison.Ordinal) ? "United States" : "Japan",
            Continent = callsign.StartsWith("K", StringComparison.Ordinal) ? "NA" : "AS",
            LotwConfirmedAt = confirmed ? new DateTime(2026, 6, 17, 11, 0, 0, DateTimeKind.Utc) : null
        };
    }
}
