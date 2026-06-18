using HamHub.Infrastructure.Persistence;
using HamHub.Infrastructure.Services;
using HamHub.Api.Services;
using HamHub.Domain.Entities;
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

    [HttpPost("reconciliation/apply")]
    [Authorize]
    public async Task<IActionResult> ApplyReconciliationAction([FromBody] QrzReconciliationApplyRequest request, CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var user = await _context.Users.FindAsync([userId], ct);
        if (user == null) return NotFound();

        var apiKeyResult = TryReadLogbookApiKey(user);
        if (apiKeyResult.Error != null) return BadRequest(apiKeyResult.Error);
        var apiKey = apiKeyResult.ApiKey!;

        try
        {
            return request.Action switch
            {
                QrzReconciliationAction.UploadLocal => await UploadLocalQso(user, apiKey, request.HamHubQsoId, ct),
                QrzReconciliationAction.ImportFromQrz => await ImportQrzQso(user, apiKey, request.QrzLogId, ct),
                QrzReconciliationAction.ReviewTime => await ApplyQrzTime(user, apiKey, request.HamHubQsoId, request.QrzLogId, ct),
                _ => BadRequest("Handlingen kan ikke udføres automatisk.")
            };
        }
        catch (QrzApiException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    private async Task<IActionResult> UploadLocalQso(ApplicationUser user, string apiKey, int? hamHubQsoId, CancellationToken ct)
    {
        if (hamHubQsoId == null) return BadRequest("HamHub QSO id mangler.");
        var qso = await _context.QsoEntries.FirstOrDefaultAsync(q => q.Id == hamHubQsoId && q.UserId == user.Id, ct);
        if (qso == null) return NotFound("QSOen findes ikke.");
        if (!string.IsNullOrWhiteSpace(qso.QrzId))
            return Ok(new QrzReconciliationApplyResponse("already-linked", "QSOen har allerede et QRZ id."));

        qso.QrzId = await _qrzClient.UploadQsoAsync(QrzSyncService.ToQrzAdif(qso), apiKey, ct);
        qso.UpdatedAt = DateTime.UtcNow;
        user.QrzLastSyncedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);
        return Ok(new QrzReconciliationApplyResponse("uploaded", "QSOen er sendt til QRZ."));
    }

    private async Task<IActionResult> ImportQrzQso(ApplicationUser user, string apiKey, string? qrzLogId, CancellationToken ct)
    {
        var qrzQso = await FindQrzLogEntry(apiKey, qrzLogId, ct);
        if (qrzQso == null) return NotFound("QRZ QSOen findes ikke.");

        var existing = await FindMatchingLocalQso(user, qrzQso, ct);
        if (existing != null)
        {
            existing.QrzId ??= qrzQso.LogId;
            QrzSyncService.ApplyFetchedQrzFields(existing, qrzQso);
            QrzSyncService.ApplyQrzConfirmation(existing, qrzQso);
            existing.UpdatedAt = DateTime.UtcNow;
            user.QrzLastSyncedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync(ct);
            return Ok(new QrzReconciliationApplyResponse("linked", "QRZ QSOen matchede en lokal QSO og blev linket uden dublet."));
        }

        _context.QsoEntries.Add(QrzSyncService.CreateImportedQso(user.Id, user.Callsign ?? string.Empty, qrzQso));
        user.QrzLastSyncedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);
        return Ok(new QrzReconciliationApplyResponse("imported", "QRZ QSOen er importeret til HamHub."));
    }

    private async Task<IActionResult> ApplyQrzTime(ApplicationUser user, string apiKey, int? hamHubQsoId, string? qrzLogId, CancellationToken ct)
    {
        if (hamHubQsoId == null) return BadRequest("HamHub QSO id mangler.");
        var qso = await _context.QsoEntries.FirstOrDefaultAsync(q => q.Id == hamHubQsoId && q.UserId == user.Id, ct);
        if (qso == null) return NotFound("QSOen findes ikke.");

        var qrzQso = await FindQrzLogEntry(apiKey, qrzLogId, ct);
        if (qrzQso == null) return NotFound("QRZ QSOen findes ikke.");
        if (!QrzSyncService.TryNormalizeQrz(qrzQso, out var band, out var mode) ||
            !QsoIdentity.IsDuplicateCandidate(
                qso,
                user.Id,
                user.Callsign ?? string.Empty,
                qrzQso.Call,
                qrzQso.TimeOn,
                band,
                mode,
                TimeSpan.FromSeconds(60),
                allowLocalTimeOffset: true))
        {
            return BadRequest("QRZ QSOen matcher ikke den lokale QSO sikkert nok til automatisk tidsretning.");
        }

        QrzSyncService.ApplyQrzTime(qso, qrzQso);
        user.QrzLastSyncedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);
        return Ok(new QrzReconciliationApplyResponse("time-updated", "QSO-tiden er sat til QRZ UTC-tiden."));
    }

    private async Task<AdifQso?> FindQrzLogEntry(string apiKey, string? qrzLogId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(qrzLogId)) return null;
        var qrzQsos = await _qrzClient.FetchLogAsync(apiKey, ct);
        return qrzQsos.FirstOrDefault(qso => string.Equals(qso.LogId, qrzLogId, StringComparison.OrdinalIgnoreCase));
    }

    private async Task<QsoEntry?> FindMatchingLocalQso(ApplicationUser user, AdifQso qrzQso, CancellationToken ct)
    {
        if (!QrzSyncService.TryNormalizeQrz(qrzQso, out var band, out var mode)) return null;
        var lower = qrzQso.TimeOn.AddHours(-2).AddSeconds(-60);
        var upper = qrzQso.TimeOn.AddHours(2).AddSeconds(60);
        var candidates = await _context.QsoEntries
            .Where(q =>
                q.UserId == user.Id &&
                q.WorkedCallsign == qrzQso.Call &&
                q.DateUtc >= lower &&
                q.DateUtc <= upper &&
                q.Mode == mode)
            .ToListAsync(ct);

        return candidates
            .OrderBy(q => Math.Abs((q.DateUtc - qrzQso.TimeOn).TotalSeconds))
            .ThenBy(q => q.Id)
            .FirstOrDefault(q => QsoIdentity.IsDuplicateCandidate(
            q,
            user.Id,
            user.Callsign ?? string.Empty,
            qrzQso.Call,
            qrzQso.TimeOn,
            band,
            mode,
            TimeSpan.FromSeconds(60),
            allowLocalTimeOffset: true));
    }

    private (string? ApiKey, string? Error) TryReadLogbookApiKey(ApplicationUser user)
    {
        if (string.IsNullOrWhiteSpace(user.QrzApiKey)) return (null, "QRZ Logbook API nøgle er ikke sat op.");
        try
        {
            return (_logbookProtector.Unprotect(user.QrzApiKey), null);
        }
        catch (CryptographicException)
        {
            return (null, "QRZ Logbook API nøgle kan ikke læses. Gem QRZ nøglen igen på profilen.");
        }
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

public record QrzReconciliationApplyRequest(
    QrzReconciliationAction Action,
    int? HamHubQsoId,
    string? QrzLogId);

public record QrzReconciliationApplyResponse(string Status, string Message);
