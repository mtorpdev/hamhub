using AutoMapper;
using HamHub.Application.Stations.DTOs;
using HamHub.Domain.Entities;
using HamHub.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace HamHub.Api.Controllers;

[ApiController]
[Route("api/stations")]
public class StationsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IMapper _mapper;

    public StationsController(ApplicationDbContext context, IMapper mapper)
    {
        _context = context;
        _mapper = mapper;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var stations = await _context.StationProfiles.ToListAsync();
        return Ok(stations.Select(s => _mapper.Map<StationDto>(s)));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var station = await _context.StationProfiles.FindAsync(id);
        if (station == null) return NotFound();
        return Ok(_mapper.Map<StationDto>(station));
    }

    [HttpGet("my")]
    [Authorize]
    public async Task<IActionResult> GetMine()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var stations = await _context.StationProfiles.Where(s => s.UserId == userId).ToListAsync();
        return Ok(stations.Select(s => _mapper.Map<StationDto>(s)));
    }

    [HttpPost]
    [Authorize]
    public async Task<IActionResult> Create([FromBody] CreateStationDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var station = _mapper.Map<StationProfile>(dto);
        station.UserId = userId;
        _context.StationProfiles.Add(station);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = station.Id }, _mapper.Map<StationDto>(station));
    }

    [HttpPut("{id}")]
    [Authorize]
    public async Task<IActionResult> Update(int id, [FromBody] CreateStationDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var station = await _context.StationProfiles.FindAsync(id);
        if (station == null) return NotFound();
        if (station.UserId != userId) return Forbid();

        station.Name = dto.Name;
        station.Callsign = dto.Callsign;
        station.RadioEquipment = dto.RadioEquipment;
        station.AntennaDescription = dto.AntennaDescription;
        station.PowerOutput = dto.PowerOutput;
        station.Location = dto.Location;
        station.GridLocator = dto.GridLocator;
        station.SupportedModes = dto.SupportedModes ?? new();
        station.SupportedBands = dto.SupportedBands ?? new();

        await _context.SaveChangesAsync();
        return Ok(_mapper.Map<StationDto>(station));
    }

    [HttpDelete("{id}")]
    [Authorize]
    public async Task<IActionResult> Delete(int id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var station = await _context.StationProfiles.FindAsync(id);
        if (station == null) return NotFound();
        if (station.UserId != userId && !User.IsInRole("Admin")) return Forbid();

        _context.StationProfiles.Remove(station);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}
