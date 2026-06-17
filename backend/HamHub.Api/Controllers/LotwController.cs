using HamHub.Api.Services;
using HamHub.Infrastructure.Persistence;
using HamHub.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Security.Cryptography;

namespace HamHub.Api.Controllers;

[ApiController]
[Route("api/lotw")]
public class LotwController : ControllerBase
{
    private readonly LotwActivityClient _activityClient;
    private readonly ApplicationDbContext _context;
    private readonly LotwSyncService _syncService;
    private readonly IDataProtector _protector;

    public LotwController(
        LotwActivityClient activityClient,
        ApplicationDbContext context,
        LotwSyncService syncService,
        IDataProtectionProvider dataProtectionProvider)
    {
        _activityClient = activityClient;
        _context = context;
        _syncService = syncService;
        _protector = dataProtectionProvider.CreateProtector("LotwPassword");
    }

    [Authorize]
    [HttpGet("activity")]
    public async Task<IActionResult> GetActivity([FromQuery] string callsigns, CancellationToken ct)
    {
        var requested = callsigns
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(call => call.ToUpperInvariant())
            .Where(call => call.Length is > 0 and <= 20)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(200)
            .ToArray();

        if (requested.Length == 0) return Ok(Array.Empty<LotwActivityDto>());

        var activity = await _activityClient.GetActivityAsync(ct);
        var result = requested
            .Where(activity.ContainsKey)
            .Select(call => new LotwActivityDto(call, activity[call]))
            .ToArray();

        return Ok(result);
    }

    [Authorize]
    [HttpGet("status")]
    public async Task<IActionResult> Status(CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var user = await _context.Users.FindAsync([userId], ct);
        if (user == null) return NotFound();

        var credentialReadable = CanRead(user.LotwPassword);
        var credentialError = user.LotwPassword != null && credentialReadable == false;

        return Ok(new
        {
            connected = user.LotwUsername != null && user.LotwPassword != null && credentialReadable != false,
            username = user.LotwUsername,
            lastSyncedAt = user.LotwLastSyncedAt,
            credentialReadable,
            credentialError,
            statusMessage = credentialError
                ? "Det gemte LoTW login kan ikke læses. Gem LoTW login igen på profilen."
                : null
        });
    }

    [Authorize]
    [HttpPost("sync")]
    public async Task<IActionResult> Sync(CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        try
        {
            return Ok(await _syncService.SyncUserAsync(userId, ct));
        }
        catch (LotwApiException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    private bool? CanRead(string? protectedValue)
    {
        if (string.IsNullOrWhiteSpace(protectedValue)) return null;
        try
        {
            _protector.Unprotect(protectedValue);
            return true;
        }
        catch (CryptographicException)
        {
            return false;
        }
    }
}
