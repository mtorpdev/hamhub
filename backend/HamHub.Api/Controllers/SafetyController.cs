using System.Security.Claims;
using HamHub.Domain.Entities;
using HamHub.Domain.Enums;
using HamHub.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HamHub.Api.Controllers;

[ApiController]
[Route("api/safety")]
[Authorize]
public class SafetyController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public SafetyController(ApplicationDbContext context)
    {
        _context = context;
    }

    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpPost("blocks")]
    public async Task<IActionResult> BlockUser([FromBody] BlockUserRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.UserId)) return BadRequest("Bruger er påkrævet");
        if (request.UserId == UserId) return BadRequest("Du kan ikke blokere dig selv");
        if (!await _context.Users.AnyAsync(u => u.Id == request.UserId)) return NotFound("Bruger ikke fundet");

        var exists = await _context.UserBlocks.AnyAsync(b => b.BlockerId == UserId && b.BlockedId == request.UserId);
        if (!exists)
        {
            _context.UserBlocks.Add(new UserBlock { BlockerId = UserId, BlockedId = request.UserId });
            await _context.SaveChangesAsync();
        }

        return NoContent();
    }

    [HttpDelete("blocks/{userId}")]
    public async Task<IActionResult> UnblockUser(string userId)
    {
        var block = await _context.UserBlocks.FirstOrDefaultAsync(b => b.BlockerId == UserId && b.BlockedId == userId);
        if (block == null) return NoContent();
        _context.UserBlocks.Remove(block);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("reports")]
    public async Task<IActionResult> Report([FromBody] CreateReportRequest request)
    {
        var targetType = (request.TargetType ?? string.Empty).Trim().ToLowerInvariant();
        if (targetType is not ("user" or "post" or "comment" or "message" or "chat"))
            return BadRequest("Ugyldig rapporttype");
        if (string.IsNullOrWhiteSpace(request.Reason)) return BadRequest("Årsag er påkrævet");

        var report = new ContentReport
        {
            ReporterId = UserId,
            TargetType = targetType,
            TargetUserId = request.TargetUserId,
            TargetId = request.TargetId,
            Reason = request.Reason.Trim(),
            Status = ReportStatus.Open
        };
        _context.ContentReports.Add(report);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetMyReports), new { id = report.Id }, await MapReport(report.Id));
    }

    [HttpGet("reports/my")]
    public async Task<IActionResult> GetMyReports()
    {
        var reports = await _context.ContentReports
            .Include(r => r.Reporter)
            .Include(r => r.TargetUser)
            .Where(r => r.ReporterId == UserId)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => MapReportDto(r))
            .ToListAsync();
        return Ok(reports);
    }

    internal static Task<bool> IsBlockedAsync(ApplicationDbContext context, string userId, string otherUserId)
    {
        return context.UserBlocks.AnyAsync(b =>
            (b.BlockerId == userId && b.BlockedId == otherUserId) ||
            (b.BlockerId == otherUserId && b.BlockedId == userId));
    }

    private async Task<ContentReportDto> MapReport(int id)
    {
        var report = await _context.ContentReports
            .Include(r => r.Reporter)
            .Include(r => r.TargetUser)
            .FirstAsync(r => r.Id == id);
        return MapReportDto(report);
    }

    internal static ContentReportDto MapReportDto(ContentReport report)
    {
        return new ContentReportDto(
            report.Id,
            report.ReporterId,
            report.Reporter.Callsign ?? report.Reporter.Email,
            report.TargetType,
            report.TargetUserId,
            report.TargetUser?.Callsign ?? report.TargetUser?.Email,
            report.TargetId,
            report.Reason,
            report.Status,
            report.CreatedAt,
            report.ResolvedAt);
    }
}

public record BlockUserRequest(string UserId);
public record CreateReportRequest(string TargetType, string? TargetUserId, int? TargetId, string Reason);
public record ContentReportDto(
    int Id,
    string ReporterId,
    string? ReporterCallsign,
    string TargetType,
    string? TargetUserId,
    string? TargetUserCallsign,
    int? TargetId,
    string Reason,
    ReportStatus Status,
    DateTime CreatedAt,
    DateTime? ResolvedAt);
