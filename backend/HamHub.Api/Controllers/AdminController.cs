using HamHub.Application.Admin.DTOs;
using HamHub.Domain.Enums;
using HamHub.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HamHub.Api.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Admin")]
public class AdminController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public AdminController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet("stats")]
    [AllowAnonymous]
    public async Task<IActionResult> PublicStats()
    {
        var stats = new DashboardStatsDto(
            TotalUsers: await _context.Users.CountAsync(),
            TotalStations: await _context.StationProfiles.CountAsync(),
            TotalQsos: await _context.QsoEntries.CountAsync(),
            TotalDxSpots: await _context.DxSpots.CountAsync(),
            TotalArticles: await _context.Articles.CountAsync()
        );
        return Ok(stats);
    }

    [HttpGet("dashboard")]
    public async Task<IActionResult> Dashboard()
    {
        var stats = new DashboardStatsDto(
            TotalUsers: await _context.Users.CountAsync(),
            TotalStations: await _context.StationProfiles.CountAsync(),
            TotalQsos: await _context.QsoEntries.CountAsync(),
            TotalDxSpots: await _context.DxSpots.CountAsync(),
            TotalArticles: await _context.Articles.CountAsync()
        );
        return Ok(stats);
    }

    [HttpGet("reports")]
    public async Task<IActionResult> GetReports([FromQuery] ReportStatus? status = null)
    {
        var query = _context.ContentReports
            .Include(r => r.Reporter)
            .Include(r => r.TargetUser)
            .AsQueryable();
        if (status != null) query = query.Where(r => r.Status == status);

        var reports = await query
            .OrderByDescending(r => r.CreatedAt)
            .Take(200)
            .ToListAsync();
        return Ok(await new SafetyController(_context).MapReportsWithContext(reports));
    }

    [HttpPost("reports/{id:int}/resolve")]
    public async Task<IActionResult> ResolveReport(int id)
    {
        var report = await _context.ContentReports.FindAsync(id);
        if (report == null) return NotFound();
        report.Status = ReportStatus.Resolved;
        report.ResolvedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("reports/{id:int}/dismiss")]
    public async Task<IActionResult> DismissReport(int id)
    {
        var report = await _context.ContentReports.FindAsync(id);
        if (report == null) return NotFound();
        report.Status = ReportStatus.Dismissed;
        report.ResolvedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return NoContent();
    }
}
