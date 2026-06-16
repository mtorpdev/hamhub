using System.Security.Claims;
using HamHub.Api.Controllers;
using HamHub.Api.Services;
using HamHub.Domain.Entities;
using HamHub.Domain.Enums;
using HamHub.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HamHub.Api.Tests;

public class CommunityOnlineUsersTests
{
    [Fact]
    public async Task GetOnlineUsers_ReturnsConnectedUsersWithFriendshipState()
    {
        await using var context = CreateContext();
        var me = new ApplicationUser { Id = "user-1", UserName = "oz1abc@hamhub.local", Email = "oz1abc@hamhub.local", Callsign = "OZ1ABC" };
        var friend = new ApplicationUser { Id = "user-2", UserName = "oz2def@hamhub.local", Email = "oz2def@hamhub.local", Callsign = "OZ2DEF", GridLocator = "JO65" };
        var candidate = new ApplicationUser { Id = "user-3", UserName = "oz3ghi@hamhub.local", Email = "oz3ghi@hamhub.local", Callsign = "OZ3GHI" };
        context.Users.AddRange(me, friend, candidate);
        context.Friendships.Add(new Friendship
        {
            RequesterId = me.Id,
            AddresseeId = friend.Id,
            Status = FriendshipStatus.Accepted
        });
        await context.SaveChangesAsync();

        var presence = new CommunityPresenceTracker();
        presence.Connect(friend.Id, "connection-1");
        presence.Connect(candidate.Id, "connection-2");
        presence.Connect(me.Id, "connection-3");
        var controller = CreateController(context, presence, me.Id);

        var result = await controller.GetOnlineUsers();

        var ok = Assert.IsType<OkObjectResult>(result);
        var users = Assert.IsAssignableFrom<IReadOnlyList<CommunityOnlineUserDto>>(ok.Value);
        Assert.Collection(
            users,
            onlineFriend =>
            {
                Assert.Equal(friend.Id, onlineFriend.Id);
                Assert.Equal("OZ2DEF", onlineFriend.Callsign);
                Assert.True(onlineFriend.IsFriend);
                Assert.Equal(FriendshipStatus.Accepted, onlineFriend.FriendshipStatus);
            },
            onlineCandidate =>
            {
                Assert.Equal(candidate.Id, onlineCandidate.Id);
                Assert.False(onlineCandidate.IsFriend);
                Assert.Null(onlineCandidate.FriendshipStatus);
            });
    }

    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    private static CommunityController CreateController(ApplicationDbContext context, CommunityPresenceTracker presence, string userId)
    {
        var controller = new CommunityController(context, presence);
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
