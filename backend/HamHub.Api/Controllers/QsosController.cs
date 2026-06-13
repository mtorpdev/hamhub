using AutoMapper;
using HamHub.Application.QsoEntries.DTOs;
using HamHub.Domain.Entities;
using HamHub.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace HamHub.Api.Controllers;

[ApiController]
[Route("api/qsos")]
[Authorize]
public class QsosController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IMapper _mapper;

    public QsosController(ApplicationDbContext context, IMapper mapper)
    {
        _context = context;
        _mapper = mapper;
    }

    [HttpGet]
    public async Task<IActionResult> GetMine([FromQuery] string? search)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var query = _context.QsoEntries.Where(q => q.UserId == userId);

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(q => q.WorkedCallsign.Contains(search) || q.OwnCallsign.Contains(search));

        var qsos = await query.OrderByDescending(q => q.DateUtc).ToListAsync();
        return Ok(qsos.Select(q => _mapper.Map<QsoDto>(q)));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var qso = await _context.QsoEntries.FindAsync(id);
        if (qso == null) return NotFound();
        if (qso.UserId != userId && !User.IsInRole("Admin")) return Forbid();
        return Ok(_mapper.Map<QsoDto>(qso));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateQsoDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var qso = _mapper.Map<QsoEntry>(dto);
        qso.UserId = userId;
        _context.QsoEntries.Add(qso);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = qso.Id }, _mapper.Map<QsoDto>(qso));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] CreateQsoDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var qso = await _context.QsoEntries.FindAsync(id);
        if (qso == null) return NotFound();
        if (qso.UserId != userId) return Forbid();

        qso.DateUtc = dto.DateUtc;
        qso.OwnCallsign = dto.OwnCallsign;
        qso.WorkedCallsign = dto.WorkedCallsign;
        qso.Band = dto.Band;
        qso.Frequency = dto.Frequency;
        qso.Mode = dto.Mode;
        qso.RstSent = dto.RstSent;
        qso.RstReceived = dto.RstReceived;
        qso.Locator = dto.Locator;
        qso.Country = dto.Country;
        qso.Notes = dto.Notes;

        await _context.SaveChangesAsync();
        return Ok(_mapper.Map<QsoDto>(qso));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var qso = await _context.QsoEntries.FindAsync(id);
        if (qso == null) return NotFound();
        if (qso.UserId != userId && !User.IsInRole("Admin")) return Forbid();

        _context.QsoEntries.Remove(qso);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}
