using HamHub.Infrastructure.Persistence;
using HamHub.Infrastructure.Services;
using HamHub.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Security.Cryptography;

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

        var logbookCredentialReadable = CanRead(user.QrzApiKey, _logbookProtector);
        var xmlCredentialReadable = CanRead(user.QrzXmlPassword, _xmlProtector);
        var logbookCredentialError = user.QrzApiKey != null && logbookCredentialReadable == false;
        var xmlCredentialError = user.QrzXmlPassword != null && xmlCredentialReadable == false;

        return Ok(new
        {
            connected = user.QrzApiKey != null && logbookCredentialReadable != false,
            lastSyncedAt = user.QrzLastSyncedAt,
            qrzCallsign = user.Callsign,
            xmlConnected = user.QrzUsername != null && xmlCredentialReadable != false,
            qrzUsername = user.QrzUsername,
            credentialReadable = logbookCredentialReadable,
            credentialError = logbookCredentialError,
            xmlCredentialReadable,
            xmlCredentialError,
            statusMessage = logbookCredentialError || xmlCredentialError
                ? "Gem QRZ oplysningerne igen på profilen. De gamle krypterede værdier kan ikke læses i dette miljø."
                : null
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

    [HttpGet("reconciliation")]
    [Authorize]
    public async Task<IActionResult> Reconciliation(CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var user = await _context.Users.FindAsync([userId], ct);
        if (user == null) return NotFound();
        if (string.IsNullOrWhiteSpace(user.QrzApiKey)) return BadRequest("QRZ Logbook API nøgle er ikke sat op.");

        string apiKey;
        try
        {
            apiKey = _logbookProtector.Unprotect(user.QrzApiKey);
        }
        catch (CryptographicException)
        {
            return BadRequest("QRZ Logbook API nøgle kan ikke læses. Gem QRZ nøglen igen på profilen.");
        }

        IReadOnlyList<AdifQso> qrzQsos;
        try
        {
            qrzQsos = await _qrzClient.FetchLogAsync(apiKey, ct);
        }
        catch (QrzApiException ex)
        {
            return BadRequest(ex.Message);
        }

        var localQsos = await _context.QsoEntries
            .Where(qso => qso.UserId == userId)
            .OrderByDescending(qso => qso.DateUtc)
            .ToListAsync(ct);

        return Ok(QrzReconciliationService.Build(
            userId,
            user.Callsign ?? string.Empty,
            localQsos,
            qrzQsos));
    }

    private static bool? CanRead(string? protectedValue, IDataProtector protector)
    {
        if (string.IsNullOrWhiteSpace(protectedValue)) return null;
        try
        {
            protector.Unprotect(protectedValue);
            return true;
        }
        catch (CryptographicException)
        {
            return false;
        }
    }
}
