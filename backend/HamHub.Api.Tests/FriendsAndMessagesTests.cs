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

public class FriendsAndMessagesTests
{
    [Fact]
    public async Task SendRequest_CreatesPendingFriendship()
    {
        await using var context = CreateContext();
        var (me, other) = SeedUsers(context);
        await context.SaveChangesAsync();
        var controller = CreateFriendsController(context, me.Id);

        var result = await controller.SendRequest(new SendFriendRequestDto(other.Id));

        var created = Assert.IsType<CreatedAtActionResult>(result);
        var dto = Assert.IsType<FriendshipDto>(created.Value);
        Assert.Equal(FriendshipStatus.Pending, dto.Status);
        Assert.Equal(other.Id, dto.OtherUserId);
        var stored = await context.Friendships.SingleAsync();
        Assert.Equal(me.Id, stored.RequesterId);
        Assert.Equal(other.Id, stored.AddresseeId);
    }

    [Fact]
    public async Task AcceptRequest_MakesFriendshipAccepted()
    {
        await using var context = CreateContext();
        var (me, other) = SeedUsers(context);
        context.Friendships.Add(new Friendship
        {
            RequesterId = other.Id,
            AddresseeId = me.Id,
            Status = FriendshipStatus.Pending
        });
        await context.SaveChangesAsync();
        var request = await context.Friendships.SingleAsync();
        var controller = CreateFriendsController(context, me.Id);

        var result = await controller.Accept(request.Id);

        Assert.IsType<OkObjectResult>(result);
        Assert.Equal(FriendshipStatus.Accepted, request.Status);
        Assert.NotNull(request.RespondedAt);
    }

    [Fact]
    public async Task RemoveFriend_DeletesAcceptedFriendship()
    {
        await using var context = CreateContext();
        var (me, other) = SeedUsers(context);
        context.Friendships.Add(new Friendship
        {
            RequesterId = me.Id,
            AddresseeId = other.Id,
            Status = FriendshipStatus.Accepted
        });
        await context.SaveChangesAsync();
        var controller = CreateFriendsController(context, me.Id);

        var result = await controller.Remove(other.Id);

        Assert.IsType<NoContentResult>(result);
        Assert.Empty(context.Friendships);
    }

    [Fact]
    public async Task SendMessage_RejectsRecipientWhoIsNotFriend()
    {
        await using var context = CreateContext();
        var (me, other) = SeedUsers(context);
        await context.SaveChangesAsync();
        var controller = CreateMessagesController(context, me.Id);

        var result = await controller.Send(new SendMessageRequest(other.Id, "Hej", "Test"));

        Assert.IsType<ForbidResult>(result);
        Assert.Empty(context.Messages);
    }

    [Fact]
    public async Task SendMessage_AllowsAcceptedFriend()
    {
        await using var context = CreateContext();
        var (me, other) = SeedUsers(context);
        context.Friendships.Add(new Friendship
        {
            RequesterId = other.Id,
            AddresseeId = me.Id,
            Status = FriendshipStatus.Accepted
        });
        await context.SaveChangesAsync();
        var controller = CreateMessagesController(context, me.Id);

        var result = await controller.Send(new SendMessageRequest(other.Id, "Hej", "Test"));

        Assert.IsType<CreatedAtActionResult>(result);
        var message = await context.Messages.SingleAsync();
        Assert.Equal(me.Id, message.SenderId);
        Assert.Equal(other.Id, message.RecipientId);
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

    private static FriendsController CreateFriendsController(ApplicationDbContext context, string userId)
    {
        var controller = new FriendsController(context);
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
