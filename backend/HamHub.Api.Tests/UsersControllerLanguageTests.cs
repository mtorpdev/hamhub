using System.Security.Claims;
using AutoMapper;
using HamHub.Api.Controllers;
using HamHub.Application.Common.Mappings;
using HamHub.Application.Users.DTOs;
using HamHub.Domain.Entities;
using HamHub.Domain.Enums;
using HamHub.Infrastructure.Persistence;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace HamHub.Api.Tests;

public class UsersControllerLanguageTests
{
    [Fact]
    public async Task SavePreferredLanguage_NormalizesAndPersistsSupportedLanguage()
    {
        await using var context = CreateContext();
        context.Users.Add(new ApplicationUser { Id = "user-1", Email = "micael.torp@gmail.com" });
        await context.SaveChangesAsync();
        var controller = CreateController(context, "user-1");

        var result = await controller.SavePreferredLanguage(new SavePreferredLanguageDto(" DA "));

        var ok = Assert.IsType<OkObjectResult>(result);
        var dto = Assert.IsType<UserDto>(ok.Value);
        Assert.Equal("da", dto.PreferredLanguage);
        Assert.Equal("da", (await context.Users.FindAsync("user-1"))!.PreferredLanguage);
    }

    [Fact]
    public async Task SavePreferredLanguage_CanClearSavedLanguage()
    {
        await using var context = CreateContext();
        context.Users.Add(new ApplicationUser
        {
            Id = "user-1",
            Email = "micael.torp@gmail.com",
            PreferredLanguage = "en"
        });
        await context.SaveChangesAsync();
        var controller = CreateController(context, "user-1");

        var result = await controller.SavePreferredLanguage(new SavePreferredLanguageDto(null));

        Assert.IsType<OkObjectResult>(result);
        Assert.Null((await context.Users.FindAsync("user-1"))!.PreferredLanguage);
    }

    [Fact]
    public async Task SavePreferredLanguage_RejectsUnsupportedLanguage()
    {
        await using var context = CreateContext();
        context.Users.Add(new ApplicationUser
        {
            Id = "user-1",
            Email = "micael.torp@gmail.com",
            PreferredLanguage = "en"
        });
        await context.SaveChangesAsync();
        var controller = CreateController(context, "user-1");

        var result = await controller.SavePreferredLanguage(new SavePreferredLanguageDto("de"));

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal("en", (await context.Users.FindAsync("user-1"))!.PreferredLanguage);
    }

    [Fact]
    public async Task UpdateMe_NormalizesPreferredLanguageWithProfileSave()
    {
        await using var context = CreateContext();
        context.Users.Add(new ApplicationUser { Id = "user-1", Email = "micael.torp@gmail.com" });
        await context.SaveChangesAsync();
        var controller = CreateController(context, "user-1");

        var result = await controller.UpdateMe(new UpdateUserDto(
            Callsign: "OZ4MT",
            FirstName: "Micael",
            LastName: "Torp",
            Country: "Denmark",
            GridLocator: "JO65",
            DefaultStationId: null,
            PreferredLanguage: " EN ",
            LicenseClass: LicenseClass.Full,
            ProfileDescription: "Testing",
            ProfileImageUrl: null,
            Visibility: ProfileVisibility.Public));

        Assert.IsType<OkObjectResult>(result);
        Assert.Equal("en", (await context.Users.FindAsync("user-1"))!.PreferredLanguage);
    }

    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    private static UsersController CreateController(ApplicationDbContext context, string userId)
    {
        var mapper = new MapperConfiguration(config => config.AddProfile<MappingProfile>(), NullLoggerFactory.Instance)
            .CreateMapper();
        var controller = new UsersController(
            userManager: null!,
            context,
            mapper,
            DataProtectionProvider.Create("HamHub.Api.Tests"),
            qrzClient: null!,
            eqslClient: null!,
            lotwClient: null!);

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
