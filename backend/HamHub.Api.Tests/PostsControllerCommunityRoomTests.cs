using System.Security.Claims;
using HamHub.Api.Controllers;
using HamHub.Domain.Entities;
using HamHub.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Xunit;

namespace HamHub.Api.Tests;

public class PostsControllerCommunityRoomTests
{
    [Fact]
    public async Task GetFeed_WithRoomSlug_ReturnsOnlyPostsInThatRoom()
    {
        await using var context = CreateContext();
        var user = new ApplicationUser { Id = "user-1", UserName = "oz1abc@hamhub.local", Email = "oz1abc@hamhub.local", Callsign = "OZ1ABC" };
        var dx = new CommunityRoom { Name = "DX", Slug = "dx", SortOrder = 1, IsSystem = true };
        var teknik = new CommunityRoom { Name = "Teknik", Slug = "teknik", SortOrder = 2, IsSystem = true };
        context.Users.Add(user);
        context.CommunityRooms.AddRange(dx, teknik);
        await context.SaveChangesAsync();
        context.Posts.AddRange(
            new Post { UserId = user.Id, CommunityRoomId = dx.Id, Content = "DX post" },
            new Post { UserId = user.Id, CommunityRoomId = teknik.Id, Content = "Teknik post" },
            new Post { UserId = user.Id, Content = "General post" });
        await context.SaveChangesAsync();
        var controller = CreateController(context, user.Id);

        var result = await controller.GetFeed(page: 1, pageSize: 20, room: "dx");

        var ok = Assert.IsType<OkObjectResult>(result);
        var payload = Assert.IsAssignableFrom<PostsFeedResponse>(ok.Value);
        var item = Assert.Single(payload.Items);
        Assert.Equal("DX post", item.Content);
        Assert.Equal("dx", item.CommunityRoomSlug);
    }

    [Fact]
    public async Task Create_WithRoomSlug_StoresPostInMatchingRoom()
    {
        await using var context = CreateContext();
        var user = new ApplicationUser { Id = "user-1", UserName = "oz1abc@hamhub.local", Email = "oz1abc@hamhub.local", Callsign = "OZ1ABC" };
        var room = new CommunityRoom { Name = "FT8/FT4", Slug = "ft8-ft4", SortOrder = 1, IsSystem = true };
        context.Users.Add(user);
        context.CommunityRooms.Add(room);
        await context.SaveChangesAsync();
        var controller = CreateController(context, user.Id);

        var result = await controller.Create(new CreatePostRequest("CQ from FT8 room", "ft8-ft4"));

        Assert.IsType<CreatedAtActionResult>(result);
        var post = await context.Posts.SingleAsync();
        Assert.Equal(room.Id, post.CommunityRoomId);
    }

    [Fact]
    public async Task ForumPostSupportsTitleTagsSearchAndSolvedState()
    {
        await using var context = CreateContext();
        var user = new ApplicationUser { Id = "user-1", UserName = "oz1abc@hamhub.local", Email = "oz1abc@hamhub.local", Callsign = "OZ1ABC" };
        var room = new CommunityRoom { Name = "POTA / SOTA / Awards", Slug = "pota-sota-awards", SortOrder = 1, IsSystem = true };
        context.Users.Add(user);
        context.CommunityRooms.Add(room);
        await context.SaveChangesAsync();
        var controller = CreateController(context, user.Id);

        var create = await controller.Create(new CreatePostRequest(
            Content: "How do I export an activation ADIF?",
            RoomSlug: "pota-sota-awards",
            Title: "POTA ADIF export",
            Tags: "pota,adif"));

        Assert.IsType<CreatedAtActionResult>(create);
        var search = await controller.GetFeed(page: 1, pageSize: 20, room: null, search: "adif", tag: "pota", solved: null);
        var ok = Assert.IsType<OkObjectResult>(search);
        var payload = Assert.IsAssignableFrom<PostsFeedResponse>(ok.Value);
        var item = Assert.Single(payload.Items);
        Assert.Equal("POTA ADIF export", item.Title);
        Assert.Equal(new[] { "pota", "adif" }, item.Tags);
        Assert.False(item.IsSolved);

        var solvedResult = await controller.SetSolved(item.Id, new SetPostSolvedRequest(true));

        Assert.IsType<OkObjectResult>(solvedResult);
        Assert.True(await context.Posts.Where(post => post.Id == item.Id).Select(post => post.IsSolved).SingleAsync());
    }

    [Fact]
    public async Task GetFeed_WithScope_SeparatesForumThreadsFromCommunityPosts()
    {
        await using var context = CreateContext();
        var user = new ApplicationUser { Id = "user-1", UserName = "oz1abc@hamhub.local", Email = "oz1abc@hamhub.local", Callsign = "OZ1ABC" };
        var communityRoom = new CommunityRoom { Name = "DX", Slug = "dx", SortOrder = 1, IsSystem = true };
        var forumRoom = new CommunityRoom { Name = "Features/Bugs", Slug = "forum-features-bugs", SortOrder = 90, IsSystem = true };
        context.Users.Add(user);
        context.CommunityRooms.AddRange(communityRoom, forumRoom);
        await context.SaveChangesAsync();
        context.Posts.AddRange(
            new Post { UserId = user.Id, CommunityRoomId = communityRoom.Id, Content = "Community DX post" },
            new Post { UserId = user.Id, CommunityRoomId = forumRoom.Id, Title = "Feature idea", Content = "Forum app feedback" });
        await context.SaveChangesAsync();
        var controller = CreateController(context, user.Id);

        var communityResult = await controller.GetFeed(page: 1, pageSize: 20, room: "alle", scope: "community");
        var forumResult = await controller.GetFeed(page: 1, pageSize: 20, room: "alle", scope: "forum");

        var communityPayload = Assert.IsAssignableFrom<PostsFeedResponse>(Assert.IsType<OkObjectResult>(communityResult).Value);
        var forumPayload = Assert.IsAssignableFrom<PostsFeedResponse>(Assert.IsType<OkObjectResult>(forumResult).Value);
        Assert.Single(communityPayload.Items);
        Assert.Equal("Community DX post", communityPayload.Items[0].Content);
        Assert.Single(forumPayload.Items);
        Assert.Equal("forum-features-bugs", forumPayload.Items[0].CommunityRoomSlug);
    }

    [Fact]
    public async Task GetFeed_OrdersPinnedThreadsBeforeRecentThreads()
    {
        await using var context = CreateContext();
        var user = new ApplicationUser { Id = "user-1", UserName = "oz1abc@hamhub.local", Email = "oz1abc@hamhub.local", Callsign = "OZ1ABC" };
        var forumRoom = new CommunityRoom { Name = "Features/Bugs", Slug = "forum-features-bugs", SortOrder = 90, IsSystem = true };
        context.Users.Add(user);
        context.CommunityRooms.Add(forumRoom);
        await context.SaveChangesAsync();
        context.Posts.AddRange(
            new Post { UserId = user.Id, CommunityRoomId = forumRoom.Id, Title = "Recent", Content = "Newest", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
            new Post { UserId = user.Id, CommunityRoomId = forumRoom.Id, Title = "Pinned", Content = "Important", IsPinned = true, CreatedAt = DateTime.UtcNow.AddDays(-2), UpdatedAt = DateTime.UtcNow.AddDays(-2) });
        await context.SaveChangesAsync();
        var controller = CreateController(context, user.Id);

        var result = await controller.GetFeed(page: 1, pageSize: 20, room: "alle", scope: "forum");

        var payload = Assert.IsAssignableFrom<PostsFeedResponse>(Assert.IsType<OkObjectResult>(result).Value);
        Assert.Equal("Pinned", payload.Items[0].Title);
        Assert.True(payload.Items[0].IsPinned);
    }

    [Fact]
    public async Task AdminCanPinAndLockThread_AndLockedThreadRejectsComments()
    {
        await using var context = CreateContext();
        var admin = new ApplicationUser { Id = "admin-1", UserName = "admin@hamhub.local", Email = "admin@hamhub.local", Callsign = "OZ4MT" };
        var user = new ApplicationUser { Id = "user-1", UserName = "oz1abc@hamhub.local", Email = "oz1abc@hamhub.local", Callsign = "OZ1ABC" };
        context.Users.AddRange(admin, user);
        context.Posts.Add(new Post { UserId = user.Id, Title = "Thread", Content = "Content" });
        await context.SaveChangesAsync();
        var post = await context.Posts.SingleAsync();
        var adminController = CreateController(context, admin.Id, isAdmin: true);
        var userController = CreateController(context, user.Id);

        var pinResult = await adminController.SetPinned(post.Id, new SetPostPinnedRequest(true));
        var lockResult = await adminController.SetLocked(post.Id, new SetPostLockedRequest(true));
        var commentResult = await userController.AddComment(post.Id, new AddCommentRequest("I should not be added"));

        Assert.IsType<OkObjectResult>(pinResult);
        Assert.IsType<OkObjectResult>(lockResult);
        Assert.IsType<BadRequestObjectResult>(commentResult);
        var updated = await context.Posts.SingleAsync();
        Assert.True(updated.IsPinned);
        Assert.True(updated.IsLocked);
        Assert.Empty(context.PostComments);
    }

    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    private static PostsController CreateController(ApplicationDbContext context, string userId, bool isAdmin = false)
    {
        var controller = new PostsController(context, new TestWebHostEnvironment());
        var claims = new List<Claim> { new(ClaimTypes.NameIdentifier, userId) };
        if (isAdmin) claims.Add(new Claim(ClaimTypes.Role, "Admin"));
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(
                    claims,
                    authenticationType: "Test"))
            }
        };
        return controller;
    }

    private sealed class TestWebHostEnvironment : IWebHostEnvironment
    {
        public string ApplicationName { get; set; } = "HamHub.Api.Tests";
        public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
        public string WebRootPath { get; set; } = Path.Combine(Path.GetTempPath(), "hamhub-api-tests");
        public string EnvironmentName { get; set; } = "Development";
        public string ContentRootPath { get; set; } = Directory.GetCurrentDirectory();
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
