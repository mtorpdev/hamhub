using AutoMapper;
using HamHub.Application.DxSpots.DTOs;
using HamHub.Api.Services;
using HamHub.Domain.Entities;
using HamHub.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace HamHub.Api.Controllers;

[ApiController]
[Route("api/spots")]
public class SpotsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IMapper _mapper;
    private readonly DxClusterSpotService _clusterSpotService;

    public SpotsController(ApplicationDbContext context, IMapper mapper, DxClusterSpotService clusterSpotService)
    {
        _context = context;
        _mapper = mapper;
        _clusterSpotService = clusterSpotService;
    }

    [HttpGet]
    public async Task<IActionResult> GetLatest([FromQuery] int limit = 50)
    {
        var spots = await _context.DxSpots
            .Include(s => s.User)
            .OrderByDescending(s => s.SpottedAt)
            .Take(Math.Min(limit, 200))
            .ToListAsync();
        return Ok(spots.Select(s => _mapper.Map<DxSpotDto>(s)));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var spot = await _context.DxSpots.Include(s => s.User).FirstOrDefaultAsync(s => s.Id == id);
        if (spot == null) return NotFound();
        return Ok(_mapper.Map<DxSpotDto>(spot));
    }

    [HttpPost]
    [Authorize]
    public async Task<IActionResult> Create([FromBody] CreateDxSpotDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var spot = _mapper.Map<DxSpot>(dto);
        spot.UserId = userId;
        _context.DxSpots.Add(spot);
        await _context.SaveChangesAsync();

        var created = await _context.DxSpots.Include(s => s.User).FirstAsync(s => s.Id == spot.Id);
        return CreatedAtAction(nameof(GetById), new { id = spot.Id }, _mapper.Map<DxSpotDto>(created));
    }

    [HttpGet("cluster")]
    public async Task<IActionResult> GetClusterSpots([FromQuery] int limit = 30, CancellationToken ct = default)
    {
        var spots = await _clusterSpotService.GetSpotsAsync(limit, ct);
        return Ok(spots.Select(s => new
        {
            s.Callsign,
            Frequency = s.FrequencyKhz,
            s.FrequencyKhz,
            s.Mode,
            s.Spotter,
            s.Info,
            s.Time,
            s.Source,
            s.RetrievedAt
        }));
    }

    [HttpDelete("{id}")]
    [Authorize]
    public async Task<IActionResult> Delete(int id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var spot = await _context.DxSpots.FindAsync(id);
        if (spot == null) return NotFound();
        if (spot.UserId != userId && !User.IsInRole("Admin")) return Forbid();

        _context.DxSpots.Remove(spot);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}
