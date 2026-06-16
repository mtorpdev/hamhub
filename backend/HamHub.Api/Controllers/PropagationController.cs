using HamHub.Api.Services;
using HamHub.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace HamHub.Api.Controllers;

[ApiController]
[Route("api/propagation")]
[Authorize]
public class PropagationController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly Kc2gMufFof2Service _mufFof2Service;

    public PropagationController(ApplicationDbContext context, Kc2gMufFof2Service mufFof2Service)
    {
        _context = context;
        _mufFof2Service = mufFof2Service;
    }

    [HttpGet("live")]
    public async Task<IActionResult> GetLive(CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null) return Unauthorized();

        if (!QsoConditionsBuilder.TryGridToLatLng(user.GridLocator, out var latitude, out var longitude))
        {
            return Ok(Kc2gMufFof2Service.Unavailable(
                "Sæt din grid locator på profilen for at se live MUF/foF2 for dit QTH."));
        }

        var location = new QsoLocationConditionsDto(
            Callsign: user.Callsign ?? user.Email ?? "Min station",
            Role: "Min station",
            Grid: user.GridLocator!.Trim().ToUpperInvariant(),
            Latitude: Math.Round(latitude, 5),
            Longitude: Math.Round(longitude, 5),
            Weather: null);

        return Ok(await _mufFof2Service.GetSnapshotAsync(location, null, ct));
    }
}
