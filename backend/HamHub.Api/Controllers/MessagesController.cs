using HamHub.Api.Hubs;
using HamHub.Domain.Entities;
using HamHub.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace HamHub.Api.Controllers;

[ApiController]
[Route("api/messages")]
[Authorize]
public class MessagesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IHubContext<PrivateMessagesHub>? _hubContext;

    public MessagesController(ApplicationDbContext context, IHubContext<PrivateMessagesHub>? hubContext = null)
    {
        _context = context;
        _hubContext = hubContext;
    }

    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    // GET /api/messages/inbox
    [HttpGet("inbox")]
    public async Task<IActionResult> GetInbox()
    {
        var messages = await _context.Messages
            .Include(m => m.Sender)
            .Where(m => m.RecipientId == UserId && !m.RecipientDeleted)
            .OrderByDescending(m => m.CreatedAt)
            .ToListAsync();
        return Ok(messages.Select(MapDto));
    }

    // GET /api/messages/sent
    [HttpGet("sent")]
    public async Task<IActionResult> GetSent()
    {
        var messages = await _context.Messages
            .Include(m => m.Recipient)
            .Where(m => m.SenderId == UserId && !m.SenderDeleted)
            .OrderByDescending(m => m.CreatedAt)
            .ToListAsync();
        return Ok(messages.Select(MapDto));
    }

    // GET /api/messages/unread-count
    [HttpGet("unread-count")]
    public async Task<IActionResult> GetUnreadCount()
    {
        var count = await _context.Messages
            .CountAsync(m => m.RecipientId == UserId && !m.IsRead && !m.RecipientDeleted);
        return Ok(new { count });
    }

    // GET /api/messages/conversation/{userId}
    [HttpGet("conversation/{otherUserId}")]
    public async Task<IActionResult> GetConversation(string otherUserId, [FromQuery] int limit = 100)
    {
        var other = await _context.Users.FindAsync(otherUserId);
        if (other == null) return NotFound("Bruger ikke fundet");
        if (!await FriendsController.AreFriendsAsync(_context, UserId, otherUserId)) return Forbid();

        var messages = await _context.Messages
            .Include(m => m.Sender)
            .Include(m => m.Recipient)
            .Where(m =>
                ((m.SenderId == UserId && m.RecipientId == otherUserId && !m.SenderDeleted) ||
                 (m.SenderId == otherUserId && m.RecipientId == UserId && !m.RecipientDeleted)))
            .OrderByDescending(m => m.CreatedAt)
            .Take(Math.Clamp(limit, 1, 200))
            .OrderBy(m => m.CreatedAt)
            .ToListAsync();

        var unread = messages.Where(m => m.RecipientId == UserId && !m.IsRead).ToList();
        if (unread.Count > 0)
        {
            foreach (var message in unread) message.IsRead = true;
            await _context.SaveChangesAsync();
        }

        return Ok(messages.Select(MapDto).ToList());
    }

    // GET /api/messages/{id}
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var message = await _context.Messages
            .Include(m => m.Sender)
            .Include(m => m.Recipient)
            .FirstOrDefaultAsync(m => m.Id == id);

        if (message == null) return NotFound();
        if (message.SenderId != UserId && message.RecipientId != UserId) return Forbid();

        // Mark as read when recipient views it
        if (message.RecipientId == UserId && !message.IsRead)
        {
            message.IsRead = true;
            await _context.SaveChangesAsync();
        }

        return Ok(MapDto(message));
    }

    // POST /api/messages
    [HttpPost]
    public async Task<IActionResult> Send([FromBody] SendMessageRequest req)
    {
        var recipient = await _context.Users.FindAsync(req.RecipientId);
        if (recipient == null) return BadRequest("Modtager ikke fundet");
        if (req.RecipientId == UserId) return BadRequest("Du kan ikke sende beskeder til dig selv");
        if (!await FriendsController.AreFriendsAsync(_context, UserId, req.RecipientId))
            return Forbid();
        if (await SafetyController.IsBlockedAsync(_context, UserId, req.RecipientId))
            return Forbid();
        if (string.IsNullOrWhiteSpace(req.Body)) return BadRequest("Besked må ikke være tom");

        var message = new Message
        {
            SenderId = UserId,
            RecipientId = req.RecipientId,
            Subject = string.IsNullOrWhiteSpace(req.Subject) ? "Privat besked" : req.Subject.Trim(),
            Body = req.Body.Trim(),
        };
        _context.Messages.Add(message);
        await _context.SaveChangesAsync();

        var created = await _context.Messages
            .Include(m => m.Sender)
            .Include(m => m.Recipient)
            .FirstAsync(m => m.Id == message.Id);
        _context.NotificationEvents.Add(new NotificationEvent
        {
            UserId = created.RecipientId,
            Type = "message",
            Title = $"Ny besked fra {DisplayName(created.Sender)}",
            Description = string.IsNullOrWhiteSpace(created.Subject) ? "Privat besked" : created.Subject,
            Href = $"/messages/{created.Id}",
            RelatedId = created.Id,
            CreatedAt = created.CreatedAt
        });
        await _context.SaveChangesAsync();

        var dto = MapDto(created);
        if (_hubContext != null)
        {
            await _hubContext.Clients
                .Groups(PrivateMessagesHub.UserGroup(created.SenderId), PrivateMessagesHub.UserGroup(created.RecipientId))
                .SendAsync("PrivateMessageCreated", dto);
            await _hubContext.Clients
                .Group(PrivateMessagesHub.UserGroup(created.RecipientId))
                .SendAsync("NotificationSummaryChanged");
        }

        return CreatedAtAction(nameof(GetById), new { id = message.Id }, dto);
    }

    // DELETE /api/messages/{id}
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var message = await _context.Messages.FindAsync(id);
        if (message == null) return NotFound();

        if (message.RecipientId == UserId)
            message.RecipientDeleted = true;
        else if (message.SenderId == UserId)
            message.SenderDeleted = true;
        else
            return Forbid();

        // Remove entirely if both sides deleted
        if (message.SenderDeleted && message.RecipientDeleted)
            _context.Messages.Remove(message);

        await _context.SaveChangesAsync();
        return NoContent();
    }

    private static object MapDto(Message m) => new
    {
        m.Id,
        m.SenderId,
        SenderCallsign = m.Sender?.Callsign ?? m.Sender?.Email,
        m.RecipientId,
        RecipientCallsign = m.Recipient?.Callsign ?? m.Recipient?.Email,
        m.Subject,
        m.Body,
        m.IsRead,
        m.CreatedAt,
    };

    private static string DisplayName(ApplicationUser? user)
    {
        return user?.Callsign ?? user?.Email ?? "Ukendt bruger";
    }
}

public record SendMessageRequest(string RecipientId, string Subject, string Body);
