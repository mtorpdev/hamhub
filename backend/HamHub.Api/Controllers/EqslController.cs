using HamHub.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Security.Cryptography;

namespace HamHub.Api.Controllers;

[ApiController]
[Route("api/eqsl")]
[Authorize]
public class EqslController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IDataProtector _eqslProtector;

    public EqslController(ApplicationDbContext context, IDataProtectionProvider dataProtectionProvider)
    {
        _context = context;
        _eqslProtector = dataProtectionProvider.CreateProtector("EqslPassword");
    }

    [HttpGet("status")]
    public async Task<IActionResult> Status(CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var user = await _context.Users.FindAsync([userId], ct);
        if (user == null) return NotFound();

        var credentialReadable = CanRead(user.EqslPassword);
        var credentialError = user.EqslPassword != null && credentialReadable == false;

        return Ok(new
        {
            connected = user.EqslUsername != null && user.EqslPassword != null && credentialReadable != false,
            username = user.EqslUsername,
            qthNickname = user.EqslQthNickname,
            lastSyncedAt = user.EqslLastSyncedAt,
            credentialReadable,
            credentialError,
            statusMessage = credentialError
                ? "Det gemte eQSL login kan ikke læses. Gem eQSL login igen på profilen."
                : null
        });
    }

    private bool? CanRead(string? protectedValue)
    {
        if (string.IsNullOrWhiteSpace(protectedValue)) return null;
        try
        {
            _eqslProtector.Unprotect(protectedValue);
            return true;
        }
        catch (CryptographicException)
        {
            return false;
        }
    }
}
