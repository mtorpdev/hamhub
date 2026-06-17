using System.Security.Claims;
using HamHub.Api.Controllers;
using HamHub.Api.Services.Awards;
using HamHub.Domain.Entities;
using HamHub.Domain.Enums;
using HamHub.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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

    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    private static AwardsController CreateController(ApplicationDbContext context, string userId)
    {
        var controller = new AwardsController(context, new AwardEngine());
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
