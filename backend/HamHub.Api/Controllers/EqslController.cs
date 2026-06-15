using HamHub.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace HamHub.Api.Controllers;

[ApiController]
[Route("api/eqsl")]
[Authorize]
public class EqslController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public EqslController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet("status")]
    public async Task<IActionResult> Status(CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var user = await _context.Users.FindAsync([userId], ct);
        if (user == null) return NotFound();

        return Ok(new
        {
            connected = user.EqslUsername != null && user.EqslPassword != null,
            username = user.EqslUsername,
            qthNickname = user.EqslQthNickname,
            lastSyncedAt = user.EqslLastSyncedAt
        });
    }
}
