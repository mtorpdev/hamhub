using System.Security.Claims;
using HamHub.Api.Controllers;
using HamHub.Domain.Entities;
using HamHub.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace HamHub.Api.Tests;

public class ChatControllerTests
{
    [Fact]
    public async Task SendRoomMessage_StoresMessageInMatchingRoom()
    {
        await using var context = CreateContext();
        var user = new ApplicationUser { Id = "user-1", UserName = "oz1abc@hamhub.local", Email = "oz1abc@hamhub.local", Callsign = "OZ1ABC" };
        var room = new CommunityRoom { Name = "DX", Slug = "dx", SortOrder = 10, IsSystem = true };
        context.Users.Add(user);
        context.CommunityRooms.Add(room);
        await context.SaveChangesAsync();
        var controller = CreateController(context, user.Id);

        var result = await controller.SendRoomMessage("dx", new SendChatMessageRequest("  CQ DX from chat  "));

        var created = Assert.IsType<CreatedAtActionResult>(result);
        var dto = Assert.IsType<ChatMessageDto>(created.Value);
        Assert.Equal("CQ DX from chat", dto.Content);
        Assert.Equal("OZ1ABC", dto.AuthorCallsign);

        var stored = await context.ChatMessages.SingleAsync();
        Assert.Equal(user.Id, stored.UserId);
        Assert.Equal(room.Id, stored.CommunityRoomId);
        Assert.Equal("CQ DX from chat", stored.Content);
    }

    [Fact]
    public async Task GetRoomMessages_ReturnsMessagesChronologically()
    {
        await using var context = CreateContext();
        var user = new ApplicationUser { Id = "user-1", UserName = "oz1abc@hamhub.local", Email = "oz1abc@hamhub.local", Callsign = "OZ1ABC" };
        var room = new CommunityRoom { Name = "FT8/FT4", Slug = "ft8-ft4", SortOrder = 20, IsSystem = true };
        context.Users.Add(user);
        context.CommunityRooms.Add(room);
        await context.SaveChangesAsync();
        context.ChatMessages.AddRange(
            new ChatMessage { UserId = user.Id, CommunityRoomId = room.Id, Content = "second", CreatedAt = new DateTime(2026, 6, 16, 8, 5, 0, DateTimeKind.Utc) },
            new ChatMessage { UserId = user.Id, CommunityRoomId = room.Id, Content = "first", CreatedAt = new DateTime(2026, 6, 16, 8, 0, 0, DateTimeKind.Utc) });
        await context.SaveChangesAsync();
        var controller = CreateController(context, user.Id);

        var result = await controller.GetRoomMessages("ft8-ft4");

        var ok = Assert.IsType<OkObjectResult>(result);
        var messages = Assert.IsAssignableFrom<IReadOnlyList<ChatMessageDto>>(ok.Value);
        Assert.Collection(
            messages,
            m => Assert.Equal("first", m.Content),
            m => Assert.Equal("second", m.Content));
    }

    [Fact]
    public async Task SendRoomMessage_RejectsUnknownRoom()
    {
        await using var context = CreateContext();
        var user = new ApplicationUser { Id = "user-1", UserName = "oz1abc@hamhub.local", Email = "oz1abc@hamhub.local", Callsign = "OZ1ABC" };
        context.Users.Add(user);
        await context.SaveChangesAsync();
        var controller = CreateController(context, user.Id);

        var result = await controller.SendRoomMessage("missing", new SendChatMessageRequest("CQ"));

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task SendRoomMessage_RejectsEmptyMessage()
    {
        await using var context = CreateContext();
        var user = new ApplicationUser { Id = "user-1", UserName = "oz1abc@hamhub.local", Email = "oz1abc@hamhub.local", Callsign = "OZ1ABC" };
        var room = new CommunityRoom { Name = "DX", Slug = "dx", SortOrder = 10, IsSystem = true };
        context.Users.Add(user);
        context.CommunityRooms.Add(room);
        await context.SaveChangesAsync();
        var controller = CreateController(context, user.Id);

        var result = await controller.SendRoomMessage("dx", new SendChatMessageRequest("   "));

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Empty(context.ChatMessages);
    }

    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    private static ChatController CreateController(ApplicationDbContext context, string userId)
    {
        var controller = new ChatController(context, NullLogger<ChatController>.Instance);
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
}
