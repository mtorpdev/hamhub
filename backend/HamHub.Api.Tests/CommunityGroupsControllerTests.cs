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
