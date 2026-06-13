using HamHub.Domain.Entities;

namespace HamHub.Application.Common.Interfaces;

public interface ITokenService
{
    string GenerateToken(ApplicationUser user, IList<string> roles);
}
