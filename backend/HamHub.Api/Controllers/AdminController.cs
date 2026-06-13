using HamHub.Application.Admin.DTOs;
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
}
