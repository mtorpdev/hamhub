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

public class NotificationsControllerTests
{
    [Fact]
    public async Task GetSummary_ReturnsUnreadMessagesFriendRequestsAndGroupActivity()
    {
        await using var context = CreateContext();
        var me = new ApplicationUser { Id = "user-1", UserName = "oz1abc@hamhub.local", Email = "oz1abc@hamhub.local", Callsign = "OZ1ABC" };
        var other = new ApplicationUser { Id = "user-2", UserName = "oz2def@hamhub.local", Email = "oz2def@hamhub.local", Callsign = "OZ2DEF" };
        var third = new ApplicationUser { Id = "user-3", UserName = "oz3ghi@hamhub.local", Email = "oz3ghi@hamhub.local", Callsign = "OZ3GHI" };
        var myGroup = new CommunityRoom { Id = 1, Name = "My club", Slug = "my-club", OwnerId = me.Id, IsSystem = false };
        var otherGroup = new CommunityRoom { Id = 2, Name = "Other club", Slug = "other-club", OwnerId = other.Id, IsSystem = false };
        context.Users.AddRange(me, other, third);
        context.CommunityRooms.AddRange(myGroup, otherGroup);
        context.Messages.AddRange(
            new Message { SenderId = other.Id, RecipientId = me.Id, Subject = "Hej", Body = "Unread" },
            new Message { SenderId = other.Id, RecipientId = me.Id, Subject = "Hej", Body = "Read", IsRead = true },
            new Message { SenderId = me.Id, RecipientId = other.Id, Subject = "Hej", Body = "Sent" });
        context.Friendships.AddRange(
            new Friendship { RequesterId = other.Id, AddresseeId = me.Id, Status = FriendshipStatus.Pending },
            new Friendship { RequesterId = me.Id, AddresseeId = other.Id, Status = FriendshipStatus.Declined });
        context.CommunityGroupMemberships.Add(new CommunityGroupMembership { CommunityRoomId = myGroup.Id, UserId = me.Id, Role = CommunityGroupRole.Owner });
        context.CommunityGroupJoinRequests.AddRange(
            new CommunityGroupJoinRequest { CommunityRoomId = myGroup.Id, UserId = other.Id, Status = CommunityGroupRequestStatus.Pending },
            new CommunityGroupJoinRequest { CommunityRoomId = otherGroup.Id, UserId = third.Id, Status = CommunityGroupRequestStatus.Pending });
        context.CommunityGroupInvitations.AddRange(
            new CommunityGroupInvitation { CommunityRoomId = otherGroup.Id, InviterId = other.Id, InviteeId = me.Id, Status = CommunityGroupRequestStatus.Pending },
            new CommunityGroupInvitation { CommunityRoomId = myGroup.Id, InviterId = me.Id, InviteeId = third.Id, Status = CommunityGroupRequestStatus.Pending });
        await context.SaveChangesAsync();
        var controller = CreateController(context, me.Id);

        var result = await controller.GetSummary();

        var ok = Assert.IsType<OkObjectResult>(result);
        var summary = Assert.IsType<NotificationSummaryDto>(ok.Value);
        Assert.Equal(1, summary.UnreadMessages);
        Assert.Equal(1, summary.IncomingFriendRequests);
        Assert.Equal(1, summary.GroupInvitations);
        Assert.Equal(1, summary.GroupJoinRequests);
        Assert.Equal(4, summary.Total);
    }

    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    private static NotificationsController CreateController(ApplicationDbContext context, string userId)
    {
        var controller = new NotificationsController(context);
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
