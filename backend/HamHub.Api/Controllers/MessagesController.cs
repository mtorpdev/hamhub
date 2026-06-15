using HamHub.Domain.Entities;
using HamHub.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace HamHub.Api.Controllers;

[ApiController]
[Route("api/messages")]
[Authorize]
public class MessagesController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public MessagesController(ApplicationDbContext context)
    {
        _context = context;
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

        var message = new Message
        {
            SenderId = UserId,
            RecipientId = req.RecipientId,
            Subject = req.Subject,
            Body = req.Body,
        };
        _context.Messages.Add(message);
        await _context.SaveChangesAsync();

        var created = await _context.Messages
            .Include(m => m.Sender)
            .Include(m => m.Recipient)
            .FirstAsync(m => m.Id == message.Id);

        return CreatedAtAction(nameof(GetById), new { id = message.Id }, MapDto(created));
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
}

public record SendMessageRequest(string RecipientId, string Subject, string Body);
