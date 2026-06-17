using System.Security.Claims;
using System.Runtime.CompilerServices;
using System.Text;
using AutoMapper;
using HamHub.Api.Controllers;
using HamHub.Api.Services;
using HamHub.Application.Common.Mappings;
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

public class QsosControllerAdifTests
{
    [Fact]
    public async Task ImportAdifStoresAwardReferenceFields()
    {
        await using var context = CreateContext();
        var controller = CreateController(context, "user-1");
        var adif = string.Concat(
            Field("CALL", "OZ1AAA"),
            Field("QSO_DATE", "20260617"),
            Field("TIME_ON", "1215"),
            Field("BAND", "20M"),
            Field("MODE", "FT8"),
            Field("STATION_CALLSIGN", "OZ1ME"),
            Field("DXCC", "221"),
            Field("CQZ", "14"),
            Field("ITUZ", "18"),
            Field("STATE", "82"),
            Field("CNTY", "DK-AR"),
            Field("MY_STATE", "DK"),
            Field("MY_CNTY", "DK-AR"),
            Field("IOTA", "EU-029"),
            Field("POTA_REF", "DK-0001, DK-0002"),
            Field("SOTA_REF", "OZ/OZ-001; OZ/OZ-002"),
            Field("AWARD_SUBMITTED", "SPECIAL-2026"),
            "<EOR>");

        var result = await controller.ImportAdif(FormFile(adif));

        Assert.IsType<OkObjectResult>(result);
        var qso = Assert.Single(context.QsoEntries);
        Assert.Equal(14, qso.CqZone);
        Assert.Equal(18, qso.ItuZone);
        Assert.Equal("DK-AR", qso.County);
        Assert.Equal("DK", qso.MyState);
        Assert.Equal("DK-AR", qso.MyCounty);
        Assert.Equal("EU-029", qso.Iota);
        Assert.Equal("DK-0001, DK-0002", qso.PotaRefs);
        Assert.Equal("OZ/OZ-001; OZ/OZ-002", qso.SotaRefs);
        Assert.Equal("SPECIAL-2026", qso.AwardRefs);
    }

    [Fact]
    public async Task ExportAdifIncludesAwardReferenceFields()
    {
        await using var context = CreateContext();
        context.QsoEntries.Add(new QsoEntry
        {
            UserId = "user-1",
            OwnCallsign = "OZ1ME",
            WorkedCallsign = "OZ1AAA",
            DateUtc = new DateTime(2026, 6, 17, 12, 15, 0, DateTimeKind.Utc),
            Band = Band.M20,
            Mode = Mode.FT8,
            Dxcc = 221,
            CqZone = 14,
            ItuZone = 18,
            State = "82",
            County = "DK-AR",
            MyState = "DK",
            MyCounty = "DK-AR",
            Iota = "EU-029",
            PotaRefs = "DK-0001, DK-0002",
            SotaRefs = "OZ/OZ-001; OZ/OZ-002",
            AwardRefs = "SPECIAL-2026"
        });
        await context.SaveChangesAsync();
        var controller = CreateController(context, "user-1");

        var result = await controller.ExportAdif();

        var file = Assert.IsType<FileContentResult>(result);
        var adif = Encoding.UTF8.GetString(file.FileContents);
        Assert.Contains(Field("CQZ", "14"), adif);
        Assert.Contains(Field("ITUZ", "18"), adif);
        Assert.Contains(Field("CNTY", "DK-AR"), adif);
        Assert.Contains(Field("MY_STATE", "DK"), adif);
        Assert.Contains(Field("MY_CNTY", "DK-AR"), adif);
        Assert.Contains(Field("IOTA", "EU-029"), adif);
        Assert.Contains(Field("POTA_REF", "DK-0001, DK-0002"), adif);
        Assert.Contains(Field("SOTA_REF", "OZ/OZ-001; OZ/OZ-002"), adif);
        Assert.Contains(Field("AWARD_SUBMITTED", "SPECIAL-2026"), adif);
    }

    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    private static QsosController CreateController(ApplicationDbContext context, string userId)
    {
        var mapper = new MapperConfiguration(config => config.AddProfile<MappingProfile>(), NullLoggerFactory.Instance).CreateMapper();
        var lookup = new DxccLookupService(new EmptyWebHostEnvironment(), NullLogger<DxccLookupService>.Instance);
        var controller = new QsosController(
            context,
            mapper,
            new TestQrzSyncTrigger(),
            new EqslClient(new HttpClient()),
            new OpenMeteoWeatherService(new HttpClient()),
            new NoaaSwpcPropagationService(new HttpClient()),
            DataProtectionProvider.Create(Path.Combine(Path.GetTempPath(), $"hamhub-tests-{Guid.NewGuid():N}")),
            new QsoAwardEnrichmentService(context, lookup));

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

    private static IFormFile FormFile(string content)
    {
        var bytes = Encoding.UTF8.GetBytes(content);
        return new FormFile(new MemoryStream(bytes), 0, bytes.Length, "file", "test.adi");
    }

    private static string Field(string name, string value) => $"<{name}:{value.Length}>{value}";

    private sealed class TestQrzSyncTrigger : IQrzSyncTrigger
    {
        public void NotifyQsoChanged(string userId) { }

        public async IAsyncEnumerable<string> ReadAsync([EnumeratorCancellation] CancellationToken ct)
        {
            await Task.CompletedTask;
            yield break;
        }
    }

    private sealed class EmptyWebHostEnvironment : IWebHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Test";
        public string ApplicationName { get; set; } = "HamHub.Api.Tests";
        public string WebRootPath { get; set; } = Path.GetTempPath();
        public IFileProvider WebRootFileProvider { get; set; } = null!;
        public string ContentRootPath { get; set; } = Path.Combine(Path.GetTempPath(), $"hamhub-empty-{Guid.NewGuid():N}");
        public IFileProvider ContentRootFileProvider { get; set; } = null!;
    }
}
