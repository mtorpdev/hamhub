using System.Runtime.CompilerServices;
using System.Security.Claims;
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
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace HamHub.Api.Tests;

public class QsosControllerDuplicateTests
{
    [Fact]
    public async Task GetDuplicatesIncludesKnownLocalTimeOffsetMatches()
    {
        await using var context = CreateContext();
        var controller = CreateController(context, "user-1");

        var first = Qso("user-1", "OZ1ME", "K1ABC", new DateTime(2026, 6, 18, 10, 0, 0, DateTimeKind.Utc));
        var shifted = Qso("user-1", "OZ1ME", "K1ABC", new DateTime(2026, 6, 18, 12, 0, 20, DateTimeKind.Utc));
        var other = Qso("user-1", "OZ1ME", "K1XYZ", new DateTime(2026, 6, 18, 12, 0, 20, DateTimeKind.Utc));
        context.QsoEntries.AddRange(first, shifted, other);
        await context.SaveChangesAsync();

        var result = await controller.GetDuplicates();

        var ok = Assert.IsType<OkObjectResult>(result);
        var groups = Assert.IsAssignableFrom<IEnumerable<QsoDuplicateGroupDto>>(ok.Value).ToList();
        var group = Assert.Single(groups);
        Assert.Equal("K1ABC", group.WorkedCallsign);
        Assert.Equal("FT8", group.Mode);
        Assert.Equal("20m", group.Band);
        Assert.Equal(new[] { shifted.Id, first.Id }, group.Qsos.Select(q => q.Id));
        Assert.Contains("lokal tids-offset", group.Reason, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task MergeDuplicatesKeepsSelectedQsoAndPreservesExternalLogFields()
    {
        await using var context = CreateContext();
        var controller = CreateController(context, "user-1");

        var keep = Qso("user-1", "OZ1ME", "K1ABC", new DateTime(2026, 6, 18, 10, 0, 0, DateTimeKind.Utc));
        keep.Comment = "local note";
        var duplicate = Qso("user-1", "OZ1ME", "K1ABC", new DateTime(2026, 6, 18, 12, 0, 20, DateTimeKind.Utc));
        duplicate.QrzId = "qrz-123";
        duplicate.QrzConfirmationStatus = "C";
        duplicate.QrzConfirmedAt = new DateTime(2026, 6, 18, 12, 5, 0, DateTimeKind.Utc);
        duplicate.EqslSentAt = new DateTime(2026, 6, 18, 12, 6, 0, DateTimeKind.Utc);
        duplicate.EqslConfirmedAt = new DateTime(2026, 6, 18, 12, 7, 0, DateTimeKind.Utc);
        duplicate.EqslLastResult = "eQSL confirmed";
        duplicate.LotwConfirmedAt = new DateTime(2026, 6, 18, 12, 8, 0, DateTimeKind.Utc);
        duplicate.LotwLastResult = "LoTW confirmed";
        duplicate.AwardRefs = "SPECIAL-2026";
        context.QsoEntries.AddRange(keep, duplicate);
        await context.SaveChangesAsync();

        var result = await controller.MergeDuplicate(new MergeDuplicateQsoDto(keep.Id, new[] { duplicate.Id }));

        var ok = Assert.IsType<OkObjectResult>(result);
        var merged = Assert.IsType<QsoDto>(ok.Value);
        Assert.Equal(keep.Id, merged.Id);
        Assert.Equal("local note", merged.Comment);
        Assert.Equal("qrz-123", merged.QrzId);
        Assert.Equal("C", merged.QrzConfirmationStatus);
        Assert.Equal("SPECIAL-2026", merged.AwardRefs);
        Assert.Single(context.QsoEntries);
        Assert.Null(await context.QsoEntries.FindAsync(duplicate.Id));
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
        var enrichment = new QsoAwardEnrichmentService(context, new DxccLookupService(new TestWebHostEnvironment(), NullLogger<DxccLookupService>.Instance));
        var analysis = new QsoAnalysisService(context, new AwardEngine());
        var controller = new QsosController(
            context,
            mapper,
            new TestQrzSyncTrigger(),
            new EqslClient(new HttpClient()),
            new OpenMeteoWeatherService(new HttpClient()),
            new NoaaSwpcPropagationService(new HttpClient()),
            DataProtectionProvider.Create(Path.Combine(Path.GetTempPath(), $"hamhub-tests-{Guid.NewGuid():N}")),
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

    private static QsoEntry Qso(string userId, string ownCallsign, string workedCallsign, DateTime dateUtc) => new()
    {
        UserId = userId,
        OwnCallsign = ownCallsign,
        WorkedCallsign = workedCallsign,
        DateUtc = dateUtc,
        Band = Band.M20,
        Frequency = 14.074,
        Mode = Mode.FT8,
        RstSent = "-10",
        RstReceived = "-08",
        CreatedAt = dateUtc,
        UpdatedAt = dateUtc
    };

    private sealed class TestQrzSyncTrigger : IQrzSyncTrigger
    {
        public void NotifyQsoChanged(string userId) { }

        public async IAsyncEnumerable<string> ReadAsync([EnumeratorCancellation] CancellationToken ct)
        {
            await Task.CompletedTask;
            yield break;
        }
    }

    private sealed class TestWebHostEnvironment : Microsoft.AspNetCore.Hosting.IWebHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Test";
        public string ApplicationName { get; set; } = "HamHub.Api.Tests";
        public string WebRootPath { get; set; } = AppContext.BaseDirectory;
        public Microsoft.Extensions.FileProviders.IFileProvider WebRootFileProvider { get; set; } = null!;
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider { get; set; } = null!;
    }
}
