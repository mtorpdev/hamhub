using System.Security.Claims;
using HamHub.Api.Controllers;
using HamHub.Domain.Entities;
using HamHub.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HamHub.Api.Tests;

public class CommunityGroupsControllerTests
{
    [Fact]
    public async Task CreateGroup_AddsOwnerMembershipAndKeepsPrivateGroupOutOfNonMemberList()
    {
        await using var context = CreateContext();
        var owner = new ApplicationUser { Id = "owner-1", UserName = "owner@hamhub.local", Email = "owner@hamhub.local", Callsign = "OZ1OWN" };
        var other = new ApplicationUser { Id = "user-2", UserName = "other@hamhub.local", Email = "other@hamhub.local", Callsign = "OZ2OTH" };
        context.Users.AddRange(owner, other);
        await context.SaveChangesAsync();
        var ownerController = CreateController(context, owner.Id);
        var otherController = CreateController(context, other.Id);

        var result = await ownerController.CreateGroup(new CreateCommunityGroupRequest("OZ Test Klub", "Privat klub", CommunityGroupVisibility.InviteOnly, false));

        var created = Assert.IsType<OkObjectResult>(result);
        var group = Assert.IsAssignableFrom<CommunityGroupDto>(created.Value);
        Assert.Equal("oz-test-klub", group.Slug);
        Assert.Equal(CommunityGroupMembershipStatus.Owner, group.MembershipStatus);
        Assert.True(await context.CommunityGroupMemberships.AnyAsync(m => m.CommunityRoomId == group.Id && m.UserId == owner.Id && m.Role == CommunityGroupRole.Owner));

        var otherGroups = Assert.IsAssignableFrom<IReadOnlyList<CommunityGroupDto>>(Assert.IsType<OkObjectResult>(await otherController.GetGroups()).Value);
        Assert.DoesNotContain(otherGroups, item => item.Id == group.Id);
    }

    [Fact]
    public async Task RequestToJoinGroup_CanBeApprovedByOwner()
    {
        await using var context = CreateContext();
        var owner = new ApplicationUser { Id = "owner-1", UserName = "owner@hamhub.local", Email = "owner@hamhub.local", Callsign = "OZ1OWN" };
        var applicant = new ApplicationUser { Id = "user-2", UserName = "other@hamhub.local", Email = "other@hamhub.local", Callsign = "OZ2OTH" };
        var group = new CommunityRoom { Name = "Award Hunters", Slug = "award-hunters", Visibility = CommunityGroupVisibility.RequestToJoin, AllowJoinRequests = true, OwnerId = owner.Id };
        context.Users.AddRange(owner, applicant);
        context.CommunityRooms.Add(group);
        await context.SaveChangesAsync();
        context.CommunityGroupMemberships.Add(new CommunityGroupMembership { CommunityRoomId = group.Id, UserId = owner.Id, Role = CommunityGroupRole.Owner });
        await context.SaveChangesAsync();
        var applicantController = CreateController(context, applicant.Id);
        var ownerController = CreateController(context, owner.Id);

        var requestResult = await applicantController.RequestToJoin(group.Id);
        var requestsResult = await ownerController.GetJoinRequests(group.Id);
        var requests = Assert.IsAssignableFrom<IReadOnlyList<CommunityGroupJoinRequestDto>>(Assert.IsType<OkObjectResult>(requestsResult).Value);
        var approveResult = await ownerController.ApproveJoinRequest(group.Id, requests.Single().Id);

        Assert.IsType<OkResult>(requestResult);
        Assert.IsType<OkResult>(approveResult);
        Assert.True(await context.CommunityGroupMemberships.AnyAsync(m => m.CommunityRoomId == group.Id && m.UserId == applicant.Id && m.Role == CommunityGroupRole.Member));
        Assert.True(await context.CommunityGroupJoinRequests.Where(r => r.UserId == applicant.Id).Select(r => r.Status == CommunityGroupRequestStatus.Approved).SingleAsync());
    }

    [Fact]
    public async Task OwnerCanManageGroupMembersAndSettings()
    {
        await using var context = CreateContext();
        var owner = new ApplicationUser { Id = "owner-1", UserName = "owner@hamhub.local", Email = "owner@hamhub.local", Callsign = "OZ1OWN" };
        var member = new ApplicationUser { Id = "member-1", UserName = "member@hamhub.local", Email = "member@hamhub.local", Callsign = "OZ1MEM" };
        var group = new CommunityRoom { Name = "Club One", Slug = "club-one", Description = "Old", OwnerId = owner.Id, IsSystem = false, Visibility = CommunityGroupVisibility.Public };
        context.Users.AddRange(owner, member);
        context.CommunityRooms.Add(group);
        await context.SaveChangesAsync();
        context.CommunityGroupMemberships.AddRange(
            new CommunityGroupMembership { CommunityRoomId = group.Id, UserId = owner.Id, Role = CommunityGroupRole.Owner },
            new CommunityGroupMembership { CommunityRoomId = group.Id, UserId = member.Id, Role = CommunityGroupRole.Member });
        await context.SaveChangesAsync();
        var ownerController = CreateController(context, owner.Id);

        var detail = Assert.IsAssignableFrom<CommunityGroupDetailDto>(Assert.IsType<OkObjectResult>(await ownerController.GetGroupBySlug("club-one")).Value);
        var members = Assert.IsAssignableFrom<IReadOnlyList<CommunityGroupMemberDto>>(Assert.IsType<OkObjectResult>(await ownerController.GetMembers(group.Id)).Value);
        var roleResult = await ownerController.UpdateMemberRole(group.Id, member.Id, new UpdateCommunityGroupMemberRoleRequest(CommunityGroupRole.Admin));
        var updateResult = await ownerController.UpdateGroup(group.Id, new UpdateCommunityGroupRequest("Club One Updated", "New", CommunityGroupVisibility.RequestToJoin, true));
        var removeResult = await ownerController.RemoveMember(group.Id, member.Id);

        Assert.Equal("Club One", detail.Name);
        Assert.Equal(2, detail.MemberCount);
        Assert.Equal(2, members.Count);
        Assert.IsType<OkResult>(roleResult);
        Assert.IsType<OkObjectResult>(updateResult);
        Assert.IsType<NoContentResult>(removeResult);
        Assert.Equal("Club One Updated", await context.CommunityRooms.Where(r => r.Id == group.Id).Select(r => r.Name).SingleAsync());
        Assert.False(await context.CommunityGroupMemberships.AnyAsync(m => m.CommunityRoomId == group.Id && m.UserId == member.Id));
    }

    [Fact]
    public async Task OwnerCanRejectRequestsDeclineInvitationsAndArchiveGroup()
    {
        await using var context = CreateContext();
        var owner = new ApplicationUser { Id = "owner-1", UserName = "owner@hamhub.local", Email = "owner@hamhub.local", Callsign = "OZ1OWN" };
        var applicant = new ApplicationUser { Id = "applicant-1", UserName = "applicant@hamhub.local", Email = "applicant@hamhub.local", Callsign = "OZ1APP" };
        var invitee = new ApplicationUser { Id = "invitee-1", UserName = "invitee@hamhub.local", Email = "invitee@hamhub.local", Callsign = "OZ1INV" };
        var group = new CommunityRoom { Name = "Archive Me", Slug = "archive-me", OwnerId = owner.Id, IsSystem = false, Visibility = CommunityGroupVisibility.RequestToJoin, AllowJoinRequests = true };
        context.Users.AddRange(owner, applicant, invitee);
        context.CommunityRooms.Add(group);
        await context.SaveChangesAsync();
        context.CommunityGroupMemberships.Add(new CommunityGroupMembership { CommunityRoomId = group.Id, UserId = owner.Id, Role = CommunityGroupRole.Owner });
        var joinRequest = new CommunityGroupJoinRequest { CommunityRoomId = group.Id, UserId = applicant.Id, Status = CommunityGroupRequestStatus.Pending };
        var invitation = new CommunityGroupInvitation { CommunityRoomId = group.Id, InviterId = owner.Id, InviteeId = invitee.Id, Status = CommunityGroupRequestStatus.Pending };
        context.CommunityGroupJoinRequests.Add(joinRequest);
        context.CommunityGroupInvitations.Add(invitation);
        await context.SaveChangesAsync();
        var ownerController = CreateController(context, owner.Id);
        var inviteeController = CreateController(context, invitee.Id);

        var rejectResult = await ownerController.RejectJoinRequest(group.Id, joinRequest.Id);
        var declineResult = await inviteeController.DeclineGroupInvitation(invitation.Id);
        var archiveResult = await ownerController.ArchiveGroup(group.Id);

        Assert.IsType<OkResult>(rejectResult);
        Assert.IsType<OkResult>(declineResult);
        Assert.IsType<NoContentResult>(archiveResult);
        Assert.Equal(CommunityGroupRequestStatus.Rejected, await context.CommunityGroupJoinRequests.Where(r => r.Id == joinRequest.Id).Select(r => r.Status).SingleAsync());
        Assert.Equal(CommunityGroupRequestStatus.Rejected, await context.CommunityGroupInvitations.Where(i => i.Id == invitation.Id).Select(i => i.Status).SingleAsync());
        Assert.True(await context.CommunityRooms.Where(r => r.Id == group.Id).Select(r => r.IsArchived).SingleAsync());
        var groups = Assert.IsAssignableFrom<IReadOnlyList<CommunityGroupDto>>(Assert.IsType<OkObjectResult>(await ownerController.GetGroups()).Value);
        Assert.DoesNotContain(groups, item => item.Id == group.Id);
    }

    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    private static CommunityController CreateController(ApplicationDbContext context, string userId)
    {
        var controller = new CommunityController(context, new HamHub.Api.Services.CommunityPresenceTracker());
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
