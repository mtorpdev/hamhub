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
    private readonly IDataProtector _logbookProtector;
    private readonly IDataProtector _xmlProtector;
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
        _logbookProtector = dataProtectionProvider.CreateProtector("QrzApiKey");
        _xmlProtector = dataProtectionProvider.CreateProtector("QrzXmlPassword");
        _config = config;
    }

    [HttpGet("lookup")]
    [AllowAnonymous]
    [EnableRateLimiting("qrz-lookup")]
    public async Task<IActionResult> Lookup([FromQuery] string callsign, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(callsign)) return BadRequest("callsign is required");

        string? sessionKey = null;

        // Try authenticated user's XML credentials first
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId != null)
        {
            var user = await _context.Users.FindAsync([userId], ct);
            if (user?.QrzUsername != null && user.QrzXmlPassword != null)
            {
                try
                {
                    var password = _xmlProtector.Unprotect(user.QrzXmlPassword);
                    sessionKey = await _qrzClient.GetSessionKeyAsync(user.QrzUsername, password, ct);
                }
                catch { sessionKey = null; }
            }
        }

        // Fall back to system default credentials
        if (sessionKey == null)
        {
            var sysUser = _config["Qrz:XmlUsername"];
            var sysPass = _config["Qrz:XmlPassword"];
            if (!string.IsNullOrWhiteSpace(sysUser) && !string.IsNullOrWhiteSpace(sysPass))
            {
                try { sessionKey = await _qrzClient.GetSessionKeyAsync(sysUser, sysPass, ct); }
                catch { sessionKey = null; }
            }
        }

        if (string.IsNullOrWhiteSpace(sessionKey)) return StatusCode(503, "QRZ XML credentials not configured");

        var result = await _qrzClient.LookupCallsignAsync(callsign.Trim().ToUpperInvariant(), sessionKey, ct);
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
            qrzCallsign = user.Callsign,
            xmlConnected = user.QrzUsername != null,
            qrzUsername = user.QrzUsername
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
