using System.Security.Claims;
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

    public AwardsController(ApplicationDbContext context, AwardEngine awardEngine)
    {
        _context = context;
        _awardEngine = awardEngine;
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

    private IQueryable<Domain.Entities.QsoEntry> UserQsos()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return _context.QsoEntries.AsNoTracking().Where(qso => qso.UserId == userId);
    }
}
