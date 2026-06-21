using System.Security.Claims;
using System.Runtime.CompilerServices;
using AutoMapper;
using HamHub.Api.Controllers;
using HamHub.Api.Services;
using HamHub.Api.Services.Awards;
using HamHub.Application.Common.Mappings;
using HamHub.Application.QsoEntries.DTOs;
using HamHub.Domain.Entities;
using HamHub.Domain.Enums;
using HamHub.Infrastructure.Persistence;
using HamHub.Infrastructure.Services;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace HamHub.Api.Tests;

public class QsosControllerCreateTests
{
    [Fact]
    public async Task CreateEnrichesMissingAwardFieldsFromDxccLookup()
    {
        await using var context = CreateContext();
        using var cty = new TemporaryCtyDirectory("""
Denmark:                  14:  18:  EU:   56.00:   -10.00:    -1.0:  OZ:
    5P,5Q,OU,OV,OW,OX,OY,OZ;
""");
        var controller = CreateController(context, "user-1", cty.Lookup);

        var result = await controller.Create(Dto(workedCallsign: "oz1aaa"));

        Assert.IsType<CreatedAtActionResult>(result);
        var qso = Assert.Single(context.QsoEntries);
        Assert.Equal("OZ1AAA", qso.WorkedCallsign);
        Assert.Equal("Denmark", qso.Country);
        Assert.Equal(221, qso.Dxcc);
        Assert.Equal("EU", qso.Continent);
        Assert.Equal(14, qso.CqZone);
        Assert.Equal(18, qso.ItuZone);
    }

    [Fact]
    public async Task CreateDoesNotOverwriteExplicitAwardFields()
    {
        await using var context = CreateContext();
        using var cty = new TemporaryCtyDirectory("""
Denmark:                  14:  18:  EU:   56.00:   -10.00:    -1.0:  OZ:
    5P,5Q,OU,OV,OW,OX,OY,OZ;
""");
        var controller = CreateController(context, "user-1", cty.Lookup);

        var result = await controller.Create(Dto(
            workedCallsign: "OZ1AAA",
            country: "User Country",
            dxcc: 999,
            continent: "XX",
            cqZone: 1,
            ituZone: 2));

        Assert.IsType<CreatedAtActionResult>(result);
        var qso = Assert.Single(context.QsoEntries);
        Assert.Equal("User Country", qso.Country);
        Assert.Equal(999, qso.Dxcc);
        Assert.Equal("XX", qso.Continent);
        Assert.Equal(1, qso.CqZone);
        Assert.Equal(2, qso.ItuZone);
    }

    [Fact]
    public async Task CreateUsesDefaultStationGridWhenMyGridsquareIsMissing()
    {
        await using var context = CreateContext();
        using var cty = new TemporaryCtyDirectory("""
Denmark:                  14:  18:  EU:   56.00:   -10.00:    -1.0:  OZ:
    5P,5Q,OU,OV,OW,OX,OY,OZ;
""");
        context.Users.Add(new ApplicationUser { Id = "user-1", DefaultStationId = 7 });
        context.StationProfiles.Add(new StationProfile { Id = 7, UserId = "user-1", Name = "Home", GridLocator = " jo65dq " });
        await context.SaveChangesAsync();
        var controller = CreateController(context, "user-1", cty.Lookup);

        var result = await controller.Create(Dto(workedCallsign: "OZ1AAA"));

        Assert.IsType<CreatedAtActionResult>(result);
        var qso = Assert.Single(context.QsoEntries);
        Assert.Equal("JO65DQ", qso.MyGridsquare);
    }

    [Fact]
    public async Task CreateKeepsExplicitMyGridsquareOverDefaultStationGrid()
    {
        await using var context = CreateContext();
        using var cty = new TemporaryCtyDirectory("""
Denmark:                  14:  18:  EU:   56.00:   -10.00:    -1.0:  OZ:
    5P,5Q,OU,OV,OW,OX,OY,OZ;
""");
        context.Users.Add(new ApplicationUser { Id = "user-1", DefaultStationId = 7 });
        context.StationProfiles.Add(new StationProfile { Id = 7, UserId = "user-1", Name = "Home", GridLocator = "JO65DQ" });
        await context.SaveChangesAsync();
        var controller = CreateController(context, "user-1", cty.Lookup);

        var result = await controller.Create(Dto(workedCallsign: "OZ1AAA", myGridsquare: "JO55WM"));

        Assert.IsType<CreatedAtActionResult>(result);
        var qso = Assert.Single(context.QsoEntries);
        Assert.Equal("JO55WM", qso.MyGridsquare);
    }

    [Fact]
    public async Task CreateMergesKnownLocalTimeOffsetDuplicateInsteadOfInserting()
    {
        await using var context = CreateContext();
        using var cty = new TemporaryCtyDirectory("""
Denmark:                  14:  18:  EU:   56.00:   -10.00:    -1.0:  OZ:
    5P,5Q,OU,OV,OW,OX,OY,OZ;
""");
        context.QsoEntries.Add(new()
        {
            UserId = "user-1",
            OwnCallsign = "OZ1ME",
            WorkedCallsign = "K1ABC",
            DateUtc = new DateTime(2026, 6, 17, 10, 0, 0, DateTimeKind.Utc),
            Band = Band.M20,
            Mode = Mode.FT8,
            RstSent = "-10"
        });
        await context.SaveChangesAsync();
        var controller = CreateController(context, "user-1", cty.Lookup);

        var result = await controller.Create(Dto(
            workedCallsign: "K1ABC",
            dateUtc: new DateTime(2026, 6, 17, 12, 0, 20, DateTimeKind.Utc)));

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Single(context.QsoEntries);
        var qso = Assert.Single(context.QsoEntries);
        Assert.Equal(new DateTime(2026, 6, 17, 10, 0, 0, DateTimeKind.Utc), qso.DateUtc);
        Assert.Equal("-10", qso.RstSent);
        Assert.Equal("-08", qso.RstReceived);
    }

    [Fact]
    public async Task CreateStoresUnspecifiedDateUtcAsUtcWithoutLocalTimezoneConversion()
    {
        await using var context = CreateContext();
        using var cty = new TemporaryCtyDirectory("""
Denmark:                  14:  18:  EU:   56.00:   -10.00:    -1.0:  OZ:
    5P,5Q,OU,OV,OW,OX,OY,OZ;
""");
        var controller = CreateController(context, "user-1", cty.Lookup);
        var wallTimeUtc = new DateTime(2026, 6, 20, 12, 34, 0, DateTimeKind.Unspecified);

        var result = await controller.Create(Dto(workedCallsign: "K1UTC", dateUtc: wallTimeUtc));

        Assert.IsType<CreatedAtActionResult>(result);
        var qso = Assert.Single(context.QsoEntries);
        Assert.Equal(new DateTime(2026, 6, 20, 12, 34, 0, DateTimeKind.Utc), qso.DateUtc);
        Assert.Equal(DateTimeKind.Utc, qso.DateUtc.Kind);
    }

    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    private static QsosController CreateController(ApplicationDbContext context, string userId, DxccLookupService lookup)
    {
        var mapper = new MapperConfiguration(config => config.AddProfile<MappingProfile>(), NullLoggerFactory.Instance).CreateMapper();
        var enrichment = new QsoAwardEnrichmentService(context, lookup);
        var provider = DataProtectionProvider.Create(Path.Combine(Path.GetTempPath(), $"hamhub-tests-{Guid.NewGuid():N}"));
        var analysis = new QsoAnalysisService(
            context,
            new AwardEngine(),
            new OpenMeteoWeatherService(new HttpClient()),
            new NoaaSwpcPropagationService(new HttpClient()),
            new Kc2gMufFof2Service(new HttpClient()),
            provider);
        var controller = new QsosController(
            context,
            mapper,
            new TestQrzSyncTrigger(),
            new EqslClient(new HttpClient()),
            new OpenMeteoWeatherService(new HttpClient()),
            new NoaaSwpcPropagationService(new HttpClient()),
            provider,
            enrichment,
            analysis);

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

    private static CreateQsoDto Dto(
        string workedCallsign,
        DateTime? dateUtc = null,
        string? country = null,
        int? dxcc = null,
        string? continent = null,
        int? cqZone = null,
        int? ituZone = null,
        string? myGridsquare = null) => new(
            DateUtc: dateUtc ?? new DateTime(2026, 6, 17, 12, 0, 0, DateTimeKind.Utc),
            OwnCallsign: "OZ1ME",
            WorkedCallsign: workedCallsign,
            Band: Band.M20,
            Frequency: 14.074,
            Mode: Mode.FT8,
            RstSent: "-10",
            RstReceived: "-08",
            Submode: null,
            Locator: "JO55",
            MyGridsquare: myGridsquare,
            Country: country,
            Dxcc: dxcc,
            Continent: continent,
            State: null,
            CqZone: cqZone,
            ItuZone: ituZone,
            County: null,
            MyState: null,
            MyCounty: null,
            Iota: null,
            PotaRefs: null,
            SotaRefs: null,
            AwardRefs: null,
            Name: null,
            Qth: null,
            TxPower: null,
            Comment: "auto logged");

    private sealed class TestQrzSyncTrigger : IQrzSyncTrigger
    {
        public void NotifyQsoChanged(string userId) { }

        public async IAsyncEnumerable<string> ReadAsync([EnumeratorCancellation] CancellationToken ct)
        {
            await Task.CompletedTask;
            yield break;
        }
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
