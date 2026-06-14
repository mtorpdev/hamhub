using HamHub.Infrastructure.Persistence;
using HamHub.Infrastructure.Services;
using HamHub.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.DataProtection;
using System.Security.Claims;

namespace HamHub.Api.Controllers;

[ApiController]
[Route("api/qrz")]
public class QrzController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly QrzClient _qrzClient;
    private readonly IQrzSyncTrigger _trigger;
    private readonly IDataProtector _protector;
    private readonly IConfiguration _config;

    public QrzController(
        ApplicationDbContext context,
        QrzClient qrzClient,
        IQrzSyncTrigger trigger,
        IDataProtectionProvider dataProtectionProvider,
        IConfiguration config)
    {
        _context = context;
        _qrzClient = qrzClient;
        _trigger = trigger;
        _protector = dataProtectionProvider.CreateProtector("QrzApiKey");
        _config = config;
    }

    [HttpGet("lookup")]
    [AllowAnonymous]
    [EnableRateLimiting("qrz-lookup")]
    public async Task<IActionResult> Lookup([FromQuery] string callsign, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(callsign)) return BadRequest("callsign is required");

        string? apiKey = null;

        // Try authenticated user's own key first
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId != null)
        {
            var user = await _context.Users.FindAsync([userId], ct);
            if (user?.QrzApiKey != null)
            {
                try { apiKey = _protector.Unprotect(user.QrzApiKey); }
                catch { apiKey = null; }
            }
        }

        // Fall back to system default key
        apiKey ??= _config["Qrz:DefaultApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey)) return StatusCode(503, "QRZ API key not configured");

        var result = await _qrzClient.LookupCallsignAsync(callsign.Trim().ToUpperInvariant(), apiKey, ct);
        if (result == null) return NotFound();
        return Ok(result);
    }

    [HttpGet("status")]
    [Authorize]
    public async Task<IActionResult> Status(CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var user = await _context.Users.FindAsync([userId], ct);
        if (user == null) return NotFound();

        return Ok(new
        {
            connected = user.QrzApiKey != null,
            lastSyncedAt = user.QrzLastSyncedAt,
            qrzCallsign = user.Callsign
        });
    }

    [HttpPost("sync")]
    [Authorize]
    public IActionResult Sync()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        _trigger.NotifyQsoChanged(userId);
        return Accepted();
    }
}
