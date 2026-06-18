using System.Security.Claims;
using AutoMapper;
using HamHub.Api.Controllers;
using HamHub.Application.Common.Mappings;
using HamHub.Application.Stations.DTOs;
using HamHub.Domain.Entities;
using HamHub.Domain.Enums;
using HamHub.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.FileProviders;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace HamHub.Api.Tests;

public class StationsControllerTests
{
    [Fact]
    public async Task CreateUpdateAndGet_ReturnsStationProfileDetailsAndImages()
    {
        await using var context = CreateContext();
        var user = new ApplicationUser { Id = "user-1", UserName = "oz1abc@hamhub.local", Email = "oz1abc@hamhub.local", Callsign = "OZ1ABC" };
        context.Users.Add(user);
        await context.SaveChangesAsync();
        var controller = CreateController(context, user.Id);

        var create = await controller.Create(new CreateStationDto(
            "Main shack",
            "OZ1ABC",
            "IC-7300",
            "Hexbeam",
            100,
            "Home QTH",
            "JO55WM",
            [Mode.FT8],
            [Band.M20],
            StationType.HomeShack,
            "Desk setup with HF and VHF radios",
            ProfileVisibility.Public));

        var created = Assert.IsType<CreatedAtActionResult>(create);
        var station = Assert.IsType<StationDto>(created.Value);
        context.StationImages.Add(new StationImage { StationProfileId = station.Id, FileName = "shack.webp", Order = 0 });
        await context.SaveChangesAsync();

        await controller.Update(station.Id, new CreateStationDto(
            "Portable box",
            "OZ1ABC/P",
            "KX3",
            "Linked dipole",
            10,
            "POTA bag",
            "JO65AB",
            [Mode.CW],
            [Band.M40],
            StationType.Portable,
            "Ready for park activations",
            ProfileVisibility.MembersOnly));

        var result = await controller.GetById(station.Id);

        var ok = Assert.IsType<OkObjectResult>(result);
        var dto = Assert.IsType<StationDto>(ok.Value);
        Assert.Equal("Portable box", dto.Name);
        Assert.Equal(StationType.Portable, dto.StationType);
        Assert.Equal("Ready for park activations", dto.Description);
        Assert.Equal(ProfileVisibility.MembersOnly, dto.Visibility);
        var image = Assert.Single(dto.Images);
        Assert.Equal("/uploads/stations/shack.webp", image.Url);
    }

    [Fact]
    public async Task UploadImage_AddsStationImageForOwner()
    {
        await using var context = CreateContext();
        var user = new ApplicationUser { Id = "user-1", UserName = "oz1abc@hamhub.local", Email = "oz1abc@hamhub.local", Callsign = "OZ1ABC" };
        var station = new StationProfile { Id = 10, UserId = user.Id, Name = "Main shack" };
        context.Users.Add(user);
        context.StationProfiles.Add(station);
        await context.SaveChangesAsync();
        var tempRoot = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempRoot);
        var controller = CreateController(context, user.Id, tempRoot);

        var result = await controller.UploadImage(station.Id, FormFile("shack.webp", "image/webp"));

        var ok = Assert.IsType<OkObjectResult>(result);
        var image = await context.StationImages.SingleAsync(i => i.StationProfileId == station.Id);
        Assert.Contains($"/uploads/stations/{image.FileName}", ok.Value!.ToString());
        Assert.True(File.Exists(Path.Combine(tempRoot, "uploads", "stations", image.FileName)));
        Directory.Delete(tempRoot, true);
    }

    [Fact]
    public async Task GetAllAndGetById_DoNotExposePrivateStationsToOtherUsers()
    {
        await using var context = CreateContext();
        var owner = new ApplicationUser { Id = "owner-1", UserName = "owner@hamhub.local", Email = "owner@hamhub.local", Callsign = "OZ1OWN" };
        var other = new ApplicationUser { Id = "other-1", UserName = "other@hamhub.local", Email = "other@hamhub.local", Callsign = "OZ1OTH" };
        context.Users.AddRange(owner, other);
        context.StationProfiles.AddRange(
            new StationProfile { Id = 21, UserId = owner.Id, Name = "Private shack", Visibility = ProfileVisibility.Private },
            new StationProfile { Id = 22, UserId = owner.Id, Name = "Public portable", Visibility = ProfileVisibility.Public });
        await context.SaveChangesAsync();
        var otherController = CreateController(context, other.Id);

        var allResult = await otherController.GetAll();
        var privateResult = await otherController.GetById(21);

        var ok = Assert.IsType<OkObjectResult>(allResult);
        var stations = Assert.IsAssignableFrom<IEnumerable<StationDto>>(ok.Value);
        Assert.DoesNotContain(stations, station => station.Id == 21);
        Assert.Contains(stations, station => station.Id == 22);
        Assert.IsType<NotFoundResult>(privateResult);
    }

    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    private static StationsController CreateController(ApplicationDbContext context, string userId, string? webRootPath = null)
    {
        var mapper = new MapperConfiguration(config => config.AddProfile<MappingProfile>(), NullLoggerFactory.Instance).CreateMapper();
        var controller = new StationsController(context, mapper, new TestWebHostEnvironment(webRootPath));
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

    private static IFormFile FormFile(string fileName, string contentType)
    {
        var bytes = "fake image"u8.ToArray();
        return new FormFile(new MemoryStream(bytes), 0, bytes.Length, "file", fileName)
        {
            Headers = new HeaderDictionary(),
            ContentType = contentType
        };
    }

    private sealed class TestWebHostEnvironment(string? webRootPath) : IWebHostEnvironment
    {
        public string ApplicationName { get; set; } = "HamHub.Tests";
        public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
        public string WebRootPath { get; set; } = webRootPath ?? Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N"));
        public string EnvironmentName { get; set; } = "Test";
        public string ContentRootPath { get; set; } = Directory.GetCurrentDirectory();
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
