using System.Security.Claims;
using HamHub.Api.Controllers;
using HamHub.Domain.Entities;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;
using OptionsFactory = Microsoft.Extensions.Options.Options;

namespace HamHub.Api.Tests;

public class UsersControllerPasswordTests
{
    [Fact]
    public async Task ChangePassword_ReturnsNoContent_WhenIdentityAcceptsPasswordChange()
    {
        var user = new ApplicationUser { Id = "user-1", Email = "micael.torp@gmail.com" };
        var userManager = new StubUserManager(user, IdentityResult.Success);
        var controller = CreateController(userManager, user.Id);

        var result = await controller.ChangePassword(new ChangePasswordDto("old-password", "2Control?!", "2Control?!"));

        Assert.IsType<NoContentResult>(result);
        Assert.Equal(user, userManager.ChangedUser);
        Assert.Equal("old-password", userManager.CurrentPassword);
        Assert.Equal("2Control?!", userManager.NewPassword);
    }

    [Fact]
    public async Task ChangePassword_ReturnsBadRequest_WhenCurrentPasswordIsRejected()
    {
        var user = new ApplicationUser { Id = "user-1", Email = "micael.torp@gmail.com" };
        var userManager = new StubUserManager(
            user,
            IdentityResult.Failed(new IdentityError { Description = "Incorrect password." }));
        var controller = CreateController(userManager, user.Id);

        var result = await controller.ChangePassword(new ChangePasswordDto("wrong-password", "2Control?!", "2Control?!"));

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("Incorrect password.", Assert.IsType<string>(badRequest.Value));
        Assert.Equal("wrong-password", userManager.CurrentPassword);
    }

    private static UsersController CreateController(UserManager<ApplicationUser> userManager, string userId)
    {
        var controller = new UsersController(
            userManager,
            context: null!,
            mapper: null!,
            dataProtectionProvider: DataProtectionProvider.Create("HamHub.Api.Tests"),
            qrzClient: null!,
            eqslClient: null!);

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

    private sealed class StubUserManager : UserManager<ApplicationUser>
    {
        private readonly ApplicationUser? _user;
        private readonly IdentityResult _changePasswordResult;

        public StubUserManager(ApplicationUser? user, IdentityResult changePasswordResult)
            : base(
                new StubUserStore(),
                OptionsFactory.Create(new IdentityOptions()),
                new PasswordHasher<ApplicationUser>(),
                Array.Empty<IUserValidator<ApplicationUser>>(),
                Array.Empty<IPasswordValidator<ApplicationUser>>(),
                new UpperInvariantLookupNormalizer(),
                new IdentityErrorDescriber(),
                null!,
                NullLogger<UserManager<ApplicationUser>>.Instance)
        {
            _user = user;
            _changePasswordResult = changePasswordResult;
        }

        public ApplicationUser? ChangedUser { get; private set; }
        public string? CurrentPassword { get; private set; }
        public string? NewPassword { get; private set; }

        public override Task<ApplicationUser?> FindByIdAsync(string userId)
        {
            return Task.FromResult(_user?.Id == userId ? _user : null);
        }

        public override Task<IdentityResult> ChangePasswordAsync(ApplicationUser user, string currentPassword, string newPassword)
        {
            ChangedUser = user;
            CurrentPassword = currentPassword;
            NewPassword = newPassword;
            return Task.FromResult(_changePasswordResult);
        }
    }

    private sealed class StubUserStore : IUserStore<ApplicationUser>
    {
        public void Dispose()
        {
        }

        public Task<IdentityResult> CreateAsync(ApplicationUser user, CancellationToken cancellationToken)
        {
            return Task.FromResult(IdentityResult.Success);
        }

        public Task<IdentityResult> DeleteAsync(ApplicationUser user, CancellationToken cancellationToken)
        {
            return Task.FromResult(IdentityResult.Success);
        }

        public Task<ApplicationUser?> FindByIdAsync(string userId, CancellationToken cancellationToken)
        {
            return Task.FromResult<ApplicationUser?>(null);
        }

        public Task<ApplicationUser?> FindByNameAsync(string normalizedUserName, CancellationToken cancellationToken)
        {
            return Task.FromResult<ApplicationUser?>(null);
        }

        public Task<string?> GetNormalizedUserNameAsync(ApplicationUser user, CancellationToken cancellationToken)
        {
            return Task.FromResult(user.NormalizedUserName);
        }

        public Task<string> GetUserIdAsync(ApplicationUser user, CancellationToken cancellationToken)
        {
            return Task.FromResult(user.Id);
        }

        public Task<string?> GetUserNameAsync(ApplicationUser user, CancellationToken cancellationToken)
        {
            return Task.FromResult(user.UserName);
        }

        public Task SetNormalizedUserNameAsync(ApplicationUser user, string? normalizedName, CancellationToken cancellationToken)
        {
            user.NormalizedUserName = normalizedName;
            return Task.CompletedTask;
        }

        public Task SetUserNameAsync(ApplicationUser user, string? userName, CancellationToken cancellationToken)
        {
            user.UserName = userName;
            return Task.CompletedTask;
        }

        public Task<IdentityResult> UpdateAsync(ApplicationUser user, CancellationToken cancellationToken)
        {
            return Task.FromResult(IdentityResult.Success);
        }
    }
}
