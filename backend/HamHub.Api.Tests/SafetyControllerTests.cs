using System.Security.Claims;
using HamHub.Api.Controllers;
using HamHub.Domain.Entities;
using HamHub.Domain.Enums;
using HamHub.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HamHub.Api.Tests;

public class SafetyControllerTests
{
    [Fact]
    public async Task BlockUser_CreatesBlockAndPreventsMessages()
    {
        await using var context = CreateContext();
        var (me, other) = SeedUsers(context);
        context.Friendships.Add(new Friendship { RequesterId = me.Id, AddresseeId = other.Id, Status = FriendshipStatus.Accepted });
        await context.SaveChangesAsync();

        var safety = CreateSafetyController(context, me.Id);
        var result = await safety.BlockUser(new BlockUserRequest(other.Id));

        Assert.IsType<NoContentResult>(result);
        Assert.True(await context.UserBlocks.AnyAsync(b => b.BlockerId == me.Id && b.BlockedId == other.Id));

        var messages = CreateMessagesController(context, other.Id);
        var send = await messages.Send(new SendMessageRequest(me.Id, "Hej", "Kan du se mig?"));
        Assert.IsType<ForbidResult>(send);
    }

    [Fact]
    public async Task ReportContent_CreatesOpenReport()
    {
        await using var context = CreateContext();
        var (me, other) = SeedUsers(context);
        await context.SaveChangesAsync();
        var controller = CreateSafetyController(context, me.Id);

        var result = await controller.Report(new CreateReportRequest("user", other.Id, null, "Spam"));

        var created = Assert.IsType<CreatedAtActionResult>(result);
        var report = Assert.IsType<ContentReportDto>(created.Value);
        Assert.Equal(ReportStatus.Open, report.Status);
        Assert.Equal("user", report.TargetType);
        Assert.Equal(other.Id, report.TargetUserId);
    }

    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    private static (ApplicationUser Me, ApplicationUser Other) SeedUsers(ApplicationDbContext context)
    {
        var me = new ApplicationUser { Id = "user-1", UserName = "oz1abc@hamhub.local", Email = "oz1abc@hamhub.local", Callsign = "OZ1ABC" };
        var other = new ApplicationUser { Id = "user-2", UserName = "oz2def@hamhub.local", Email = "oz2def@hamhub.local", Callsign = "OZ2DEF" };
        context.Users.AddRange(me, other);
        return (me, other);
    }

    private static SafetyController CreateSafetyController(ApplicationDbContext context, string userId)
    {
        var controller = new SafetyController(context);
        controller.ControllerContext = ControllerContextFor(userId);
        return controller;
    }

    private static MessagesController CreateMessagesController(ApplicationDbContext context, string userId)
    {
        var controller = new MessagesController(context);
        controller.ControllerContext = ControllerContextFor(userId);
        return controller;
    }

    private static ControllerContext ControllerContextFor(string userId) => new()
    {
        HttpContext = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(
                new[] { new Claim(ClaimTypes.NameIdentifier, userId) },
                authenticationType: "Test"))
        }
    };
}
