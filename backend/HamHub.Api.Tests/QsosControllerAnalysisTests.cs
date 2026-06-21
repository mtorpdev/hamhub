using System.Security.Claims;
using System.Runtime.CompilerServices;
using AutoMapper;
using HamHub.Api.Controllers;
using HamHub.Api.Services;
using HamHub.Api.Services.Awards;
using HamHub.Application.Common.Mappings;
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

public class QsosControllerAnalysisTests
{
    [Fact]
    public async Task GetAnalysisReturnsOkForOwner()
    {
        await using var context = CreateContext();
        var user = new ApplicationUser
        {
            Id = "user-1",
            Email = "user-1@example.com",
            UserName = "user-1@example.com",
            Callsign = "OZ1ME"
        };
        var qso = new QsoEntry
        {
            UserId = user.Id,
            User = user,
            OwnCallsign = "OZ1ME",
            WorkedCallsign = "DL1ABC",
            DateUtc = new DateTime(2026, 6, 21, 10, 0, 0, DateTimeKind.Utc),
            Band = Band.M20,
            Frequency = 14.074,
            Mode = Mode.FT8,
            RstSent = "-10",
            RstReceived = "-08",
            Locator = "JO62QM",
            MyGridsquare = "JO65DQ",
            Dxcc = 230,
            Country = "Fed. Rep. of Germany",
            Continent = "EU",
            CqZone = 14,
            ItuZone = 28,
            TxPower = 50,
            LotwConfirmedAt = new DateTime(2026, 6, 21, 10, 5, 0, DateTimeKind.Utc)
        };
        context.Users.Add(user);
        context.QsoEntries.Add(qso);
        await context.SaveChangesAsync();

        var controller = CreateController(context, "user-1");

        var result = await controller.GetAnalysis(qso.Id, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<QsoAnalysisResponse>(ok.Value);
        Assert.Equal(qso.Id, response.QsoId);
        Assert.Equal(100, response.Scores.Confirmation);
    }

    [Fact]
    public async Task GetAnalysisReturnsUnauthorizedWithoutUserId()
    {
        await using var context = CreateContext();
        var controller = CreateController(context, userId: null);

        var result = await controller.GetAnalysis(123, CancellationToken.None);

        Assert.IsType<UnauthorizedResult>(result);
    }

    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    private static QsosController CreateController(ApplicationDbContext context, string? userId)
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
                User = userId is null
                    ? new ClaimsPrincipal(new ClaimsIdentity())
                    : new ClaimsPrincipal(new ClaimsIdentity(
                        new[] { new Claim(ClaimTypes.NameIdentifier, userId) },
                        authenticationType: "Test"))
            }
        };

        return controller;
    }

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
