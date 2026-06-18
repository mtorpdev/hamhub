using System.Security.Claims;
using HamHub.Api.Hubs;
using HamHub.Domain.Entities;
using HamHub.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace HamHub.Api.Controllers;

[ApiController]
[Route("api/chat")]
[Authorize]
public class ChatController : ControllerBase
{
    private const int MaxMessageLength = 1000;
    private readonly ApplicationDbContext _context;
    private readonly ILogger<ChatController> _logger;
    private readonly IHubContext<CommunityChatHub>? _hubContext;

    public ChatController(
        ApplicationDbContext context,
        ILogger<ChatController> logger,
        IHubContext<CommunityChatHub>? hubContext = null)
    {
        _context = context;
        _logger = logger;
        _hubContext = hubContext;
    }

    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpGet("rooms/{roomSlug}/messages")]
    public async Task<IActionResult> GetRoomMessages(string roomSlug, [FromQuery] int limit = 60)
    {
        var room = await FindRoomAsync(roomSlug);
        if (roomSlug != "alle" && room == null) return NotFound("Chatrum ikke fundet");
        if (room != null && (room.IsArchived || !CanAccessRoom(room))) return Forbid();

        var clampedLimit = Math.Clamp(limit, 1, 200);
        var query = _context.ChatMessages
            .Include(m => m.User)
            .Include(m => m.CommunityRoom)
            .AsQueryable();

        query = room == null
            ? query.Where(m => m.CommunityRoomId == null)
            : query.Where(m => m.CommunityRoomId == room.Id);

        var messages = await query
            .OrderByDescending(m => m.CreatedAt)
            .Take(clampedLimit)
            .OrderBy(m => m.CreatedAt)
            .ToListAsync();

        return Ok(messages.Select(MapDto).ToList());
    }

    [HttpPost("rooms/{roomSlug}/messages")]
    public async Task<IActionResult> SendRoomMessage(string roomSlug, [FromBody] SendChatMessageRequest request)
    {
        var content = (request.Content ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(content)) return BadRequest("Beskeden må ikke være tom");
        if (content.Length > MaxMessageLength) return BadRequest($"Beskeden må maks være {MaxMessageLength} tegn");

        var room = await FindRoomAsync(roomSlug);
        if (roomSlug != "alle" && room == null) return NotFound("Chatrum ikke fundet");
        if (room != null && (room.IsArchived || !CanAccessRoom(room))) return Forbid();

        var message = new ChatMessage
        {
            UserId = UserId,
            CommunityRoomId = room?.Id,
            Content = content,
            CreatedAt = DateTime.UtcNow,
        };

        _context.ChatMessages.Add(message);
        await _context.SaveChangesAsync();

        var created = await _context.ChatMessages
            .Include(m => m.User)
            .Include(m => m.CommunityRoom)
            .FirstAsync(m => m.Id == message.Id);

        var dto = MapDto(created);
        if (_hubContext != null)
        {
            await _hubContext.Clients
                .Group(CommunityChatHub.RoomGroup(dto.CommunityRoomSlug ?? "alle"))
                .SendAsync("RoomMessageCreated", dto);
        }
        else
        {
            _logger.LogDebug("Community chat hub is not available; message {MessageId} was stored without broadcast.", dto.Id);
        }

        return CreatedAtAction(nameof(GetRoomMessages), new { roomSlug = dto.CommunityRoomSlug ?? "alle" }, dto);
    }

    private async Task<CommunityRoom?> FindRoomAsync(string roomSlug)
    {
        var normalized = string.IsNullOrWhiteSpace(roomSlug)
            ? "alle"
            : roomSlug.Trim().ToLowerInvariant();
        if (normalized == "alle") return null;
        return await _context.CommunityRooms
            .Include(r => r.Memberships)
            .FirstOrDefaultAsync(r => r.Slug == normalized && !r.IsArchived);
    }

    private bool CanAccessRoom(CommunityRoom room)
    {
        if (room.Slug.StartsWith("forum-")) return false;
        if (room.Visibility == CommunityGroupVisibility.Public) return true;
        return room.Memberships.Any(m => m.UserId == UserId);
    }

    private static ChatMessageDto MapDto(ChatMessage message) => new(
        message.Id,
        message.UserId,
        message.User?.Callsign ?? message.User?.Email,
        message.CommunityRoomId,
        message.CommunityRoom?.Slug,
        message.CommunityRoom?.Name,
        message.Content,
        message.CreatedAt);
}

public record SendChatMessageRequest(string Content);

public record ChatMessageDto(
    int Id,
    string UserId,
    string? AuthorCallsign,
    int? CommunityRoomId,
    string? CommunityRoomSlug,
    string? CommunityRoomName,
    string Content,
    DateTime CreatedAt);
