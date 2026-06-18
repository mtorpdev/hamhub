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

    [Fact]
    public async Task GetCenter_ReturnsActionableNotificationsForCurrentUser()
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
            new Message { Id = 1, SenderId = other.Id, RecipientId = me.Id, Subject = "Ping", Body = "Unread", CreatedAt = DateTime.UtcNow.AddMinutes(-3) },
            new Message { Id = 2, SenderId = other.Id, RecipientId = me.Id, Subject = "Old", Body = "Read", IsRead = true, CreatedAt = DateTime.UtcNow.AddMinutes(-20) });
        context.Friendships.Add(new Friendship
        {
            Id = 1,
            RequesterId = other.Id,
            AddresseeId = me.Id,
            Status = FriendshipStatus.Pending,
            CreatedAt = DateTime.UtcNow.AddMinutes(-2)
        });
        context.CommunityGroupMemberships.Add(new CommunityGroupMembership { CommunityRoomId = myGroup.Id, UserId = me.Id, Role = CommunityGroupRole.Owner });
        context.CommunityGroupInvitations.Add(new CommunityGroupInvitation
        {
            Id = 1,
            CommunityRoomId = otherGroup.Id,
            InviterId = other.Id,
            InviteeId = me.Id,
            Status = CommunityGroupRequestStatus.Pending,
            CreatedAt = DateTime.UtcNow.AddMinutes(-1)
        });
        context.CommunityGroupJoinRequests.Add(new CommunityGroupJoinRequest
        {
            Id = 1,
            CommunityRoomId = myGroup.Id,
            UserId = third.Id,
            Status = CommunityGroupRequestStatus.Pending,
            CreatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();
        var controller = CreateController(context, me.Id);

        var result = await controller.GetCenter();

        var ok = Assert.IsType<OkObjectResult>(result);
        var center = Assert.IsType<NotificationCenterDto>(ok.Value);
        Assert.Equal(4, center.Summary.Total);
        Assert.Collection(center.Items,
            item =>
            {
                Assert.Equal("group-join-request", item.Type);
                Assert.Equal("Join request til My club", item.Title);
                Assert.Equal("/community/groups/my-club", item.Href);
                Assert.Equal(1, item.GroupId);
                Assert.Equal(1, item.RelatedId);
            },
            item =>
            {
                Assert.Equal("group-invitation", item.Type);
                Assert.Equal("Invitation til Other club", item.Title);
                Assert.Equal("/community/groups/other-club", item.Href);
            },
            item =>
            {
                Assert.Equal("friend-request", item.Type);
                Assert.Equal("Venneanmodning fra OZ2DEF", item.Title);
                Assert.Equal("/messages?tab=requests", item.Href);
            },
            item =>
            {
                Assert.Equal("message", item.Type);
                Assert.Equal("Ny besked fra OZ2DEF", item.Title);
                Assert.Equal("/messages/1", item.Href);
            });
    }

    [Fact]
    public async Task GetHistory_ReturnsStoredNotificationEventsForCurrentUser()
    {
        await using var context = CreateContext();
        var me = new ApplicationUser { Id = "user-1", UserName = "oz1abc@hamhub.local", Email = "oz1abc@hamhub.local", Callsign = "OZ1ABC" };
        var other = new ApplicationUser { Id = "user-2", UserName = "oz2def@hamhub.local", Email = "oz2def@hamhub.local", Callsign = "OZ2DEF" };
        context.Users.AddRange(me, other);
        context.NotificationEvents.AddRange(
            new NotificationEvent
            {
                UserId = me.Id,
                Type = "message",
                Title = "Ny besked fra OZ2DEF",
                Description = "Ping",
                Href = "/messages/1",
                RelatedId = 1,
                CreatedAt = DateTime.UtcNow.AddMinutes(-1)
            },
            new NotificationEvent
            {
                UserId = me.Id,
                Type = "friend-request",
                Title = "Venneanmodning fra OZ2DEF",
                Description = "Accepter eller afvis anmodningen",
                Href = "/messages?tab=requests",
                RelatedId = 2,
                CreatedAt = DateTime.UtcNow.AddMinutes(-2),
                ReadAt = DateTime.UtcNow.AddMinutes(-1)
            },
            new NotificationEvent
            {
                UserId = other.Id,
                Type = "message",
                Title = "Anden bruger",
                Description = "Skal ikke med",
                Href = "/messages/99"
            });
        await context.SaveChangesAsync();
        var controller = CreateController(context, me.Id);

        var result = await controller.GetHistory();

        var ok = Assert.IsType<OkObjectResult>(result);
        var history = Assert.IsType<NotificationHistoryDto>(ok.Value);
        Assert.Equal(2, history.Items.Count);
        Assert.Equal(1, history.UnreadCount);
        Assert.Collection(history.Items,
            item =>
            {
                Assert.Equal("message", item.Type);
                Assert.False(item.IsRead);
            },
            item =>
            {
                Assert.Equal("friend-request", item.Type);
                Assert.True(item.IsRead);
            });
    }

    [Fact]
    public async Task MarkHistoryRead_MarksOnlyCurrentUsersEventsRead()
    {
        await using var context = CreateContext();
        var me = new ApplicationUser { Id = "user-1", UserName = "oz1abc@hamhub.local", Email = "oz1abc@hamhub.local", Callsign = "OZ1ABC" };
        var other = new ApplicationUser { Id = "user-2", UserName = "oz2def@hamhub.local", Email = "oz2def@hamhub.local", Callsign = "OZ2DEF" };
        context.Users.AddRange(me, other);
        context.NotificationEvents.AddRange(
            new NotificationEvent { UserId = me.Id, Type = "message", Title = "A", Description = "A", Href = "/messages/1" },
            new NotificationEvent { UserId = other.Id, Type = "message", Title = "B", Description = "B", Href = "/messages/2" });
        await context.SaveChangesAsync();
        var controller = CreateController(context, me.Id);

        var result = await controller.MarkHistoryRead();

        Assert.IsType<NoContentResult>(result);
        Assert.True(await context.NotificationEvents.AnyAsync(e => e.UserId == me.Id && e.ReadAt != null));
        Assert.True(await context.NotificationEvents.AnyAsync(e => e.UserId == other.Id && e.ReadAt == null));
    }

    [Fact]
    public async Task MarkActionHandled_MarksMatchingCurrentUserEventsRead()
    {
        await using var context = CreateContext();
        var me = new ApplicationUser { Id = "user-1", UserName = "oz1abc@hamhub.local", Email = "oz1abc@hamhub.local", Callsign = "OZ1ABC" };
        var other = new ApplicationUser { Id = "user-2", UserName = "oz2def@hamhub.local", Email = "oz2def@hamhub.local", Callsign = "OZ2DEF" };
        context.Users.AddRange(me, other);
        context.NotificationEvents.AddRange(
            new NotificationEvent { UserId = me.Id, Type = "group-invitation", Title = "A", Description = "A", Href = "/community/groups/a", RelatedId = 11, GroupId = 5 },
            new NotificationEvent { UserId = me.Id, Type = "group-invitation", Title = "B", Description = "B", Href = "/community/groups/b", RelatedId = 12, GroupId = 5 },
            new NotificationEvent { UserId = other.Id, Type = "group-invitation", Title = "C", Description = "C", Href = "/community/groups/a", RelatedId = 11, GroupId = 5 });
        await context.SaveChangesAsync();
        var controller = CreateController(context, me.Id);

        var result = await controller.MarkActionHandled(new NotificationActionHandledRequest("group-invitation", 11, 5));

        Assert.IsType<NoContentResult>(result);
        Assert.True(await context.NotificationEvents.AnyAsync(e => e.UserId == me.Id && e.RelatedId == 11 && e.ReadAt != null));
        Assert.True(await context.NotificationEvents.AnyAsync(e => e.UserId == me.Id && e.RelatedId == 12 && e.ReadAt == null));
        Assert.True(await context.NotificationEvents.AnyAsync(e => e.UserId == other.Id && e.RelatedId == 11 && e.ReadAt == null));
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
