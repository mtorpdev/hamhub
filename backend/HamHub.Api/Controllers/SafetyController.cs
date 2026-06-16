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

    [HttpGet("blocks")]
    public async Task<IActionResult> GetBlockedUsers()
    {
        var blocks = await _context.UserBlocks
            .Include(b => b.Blocked)
            .Where(b => b.BlockerId == UserId)
            .OrderBy(b => b.Blocked.Callsign ?? b.Blocked.Email)
            .Select(b => new BlockedUserDto(
                b.BlockedId,
                b.Blocked.Callsign,
                b.Blocked.Email,
                FullName(b.Blocked),
                b.Blocked.GridLocator,
                b.Blocked.Country,
                b.CreatedAt))
            .ToListAsync();
        return Ok(blocks);
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
            .ToListAsync();
        return Ok(await MapReportsWithContext(reports));
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
        return (await MapReportsWithContext(new[] { report })).Single();
    }

    internal static ContentReportDto MapReportDto(ContentReport report, string? context = null)
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
            context,
            report.Status,
            report.CreatedAt,
            report.ResolvedAt);
    }

    internal async Task<IReadOnlyList<ContentReportDto>> MapReportsWithContext(IEnumerable<ContentReport> reports)
    {
        var reportList = reports.ToList();
        var postIds = reportList.Where(r => r.TargetType == "post" && r.TargetId != null).Select(r => r.TargetId!.Value).Distinct().ToList();
        var commentIds = reportList.Where(r => r.TargetType == "comment" && r.TargetId != null).Select(r => r.TargetId!.Value).Distinct().ToList();
        var messageIds = reportList.Where(r => r.TargetType == "message" && r.TargetId != null).Select(r => r.TargetId!.Value).Distinct().ToList();
        var chatIds = reportList.Where(r => r.TargetType == "chat" && r.TargetId != null).Select(r => r.TargetId!.Value).Distinct().ToList();

        var posts = postIds.Count == 0
            ? new Dictionary<int, string>()
            : await _context.Posts.Where(p => postIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, p => p.Content);
        var comments = commentIds.Count == 0
            ? new Dictionary<int, string>()
            : await _context.PostComments.Where(c => commentIds.Contains(c.Id)).ToDictionaryAsync(c => c.Id, c => c.Content);
        var messages = messageIds.Count == 0
            ? new Dictionary<int, string>()
            : await _context.Messages.Where(m => messageIds.Contains(m.Id)).ToDictionaryAsync(m => m.Id, m => m.Body);
        var chats = chatIds.Count == 0
            ? new Dictionary<int, string>()
            : await _context.ChatMessages.Where(m => chatIds.Contains(m.Id)).ToDictionaryAsync(m => m.Id, m => m.Content);

        return reportList.Select(report =>
        {
            string? context = report.TargetType switch
            {
                "post" when report.TargetId != null && posts.TryGetValue(report.TargetId.Value, out var value) => value,
                "comment" when report.TargetId != null && comments.TryGetValue(report.TargetId.Value, out var value) => value,
                "message" when report.TargetId != null && messages.TryGetValue(report.TargetId.Value, out var value) => value,
                "chat" when report.TargetId != null && chats.TryGetValue(report.TargetId.Value, out var value) => value,
                "user" => report.TargetUser?.ProfileDescription,
                _ => null
            };
            return MapReportDto(report, context);
        }).ToList();
    }

    private static string? FullName(ApplicationUser user)
    {
        var name = $"{user.FirstName} {user.LastName}".Trim();
        return string.IsNullOrWhiteSpace(name) ? null : name;
    }
}

public record BlockUserRequest(string UserId);
public record CreateReportRequest(string TargetType, string? TargetUserId, int? TargetId, string Reason);
public record BlockedUserDto(
    string UserId,
    string? Callsign,
    string? Email,
    string? Name,
    string? GridLocator,
    string? Country,
    DateTime CreatedAt);
public record ContentReportDto(
    int Id,
    string ReporterId,
    string? ReporterCallsign,
    string TargetType,
    string? TargetUserId,
    string? TargetUserCallsign,
    int? TargetId,
    string Reason,
    string? Context,
    ReportStatus Status,
    DateTime CreatedAt,
    DateTime? ResolvedAt);
