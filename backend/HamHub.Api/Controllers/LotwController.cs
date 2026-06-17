using HamHub.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HamHub.Api.Controllers;

[ApiController]
[Route("api/lotw")]
public class LotwController : ControllerBase
{
    private readonly LotwActivityClient _activityClient;

    public LotwController(LotwActivityClient activityClient)
    {
        _activityClient = activityClient;
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
}
