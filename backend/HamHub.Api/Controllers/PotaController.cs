using HamHub.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace HamHub.Api.Controllers;

[ApiController]
[Route("api/pota")]
public class PotaController : ControllerBase
{
    private readonly PotaClient _potaClient;

    public PotaController(PotaClient potaClient)
    {
        _potaClient = potaClient;
    }

    [HttpGet("spots")]
    public async Task<IActionResult> GetSpots(CancellationToken ct = default)
    {
        var spots = await _potaClient.GetActiveSpotsAsync(ct);
        return Ok(spots);
    }
}
