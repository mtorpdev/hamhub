using System.Security.Claims;
using HamHub.Api.Services;
using HamHub.Api.Services.Awards;
using HamHub.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HamHub.Api.Controllers;

[ApiController]
[Route("api/awards")]
[Authorize]
public class AwardsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly AwardEngine _awardEngine;
    private readonly QsoAwardEnrichmentService _awardEnrichment;

    public AwardsController(
        ApplicationDbContext context,
        AwardEngine awardEngine,
        QsoAwardEnrichmentService awardEnrichment)
    {
        _context = context;
        _awardEngine = awardEngine;
        _awardEnrichment = awardEnrichment;
    }

    [HttpGet("catalog")]
    public IActionResult GetCatalog()
    {
        return Ok(AwardCatalog.Items());
    }

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary([FromQuery] AwardQuery query, CancellationToken ct = default)
    {
        var qsos = await UserQsos().ToListAsync(ct);
        return Ok(_awardEngine.Calculate(qsos, query));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetDetail(string id, [FromQuery] AwardQuery query, CancellationToken ct = default)
    {
        var qsos = await UserQsos().ToListAsync(ct);
        var detail = _awardEngine.Detail(qsos, id, query);
        return detail is null ? NotFound() : Ok(detail);
    }

    [HttpPost("backfill")]
    public async Task<IActionResult> Backfill([FromBody] AwardBackfillRequest request, CancellationToken ct = default)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();

        var result = await _awardEnrichment.BackfillMissingAsync(userId, request.DryRun, ct);
        return Ok(result);
    }

    private IQueryable<Domain.Entities.QsoEntry> UserQsos()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return _context.QsoEntries.AsNoTracking().Where(qso => qso.UserId == userId);
    }
}

public record AwardBackfillRequest(bool DryRun = false);
