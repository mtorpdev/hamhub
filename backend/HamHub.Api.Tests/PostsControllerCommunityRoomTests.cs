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

    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    private static PostsController CreateController(ApplicationDbContext context, string userId)
    {
        var controller = new PostsController(context, new TestWebHostEnvironment());
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
