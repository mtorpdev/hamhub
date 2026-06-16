using System.Security.Claims;
using HamHub.Domain.Enums;
using HamHub.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HamHub.Api.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public NotificationsController(ApplicationDbContext context)
    {
        _context = context;
    }

    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary()
    {
        var unreadMessages = await _context.Messages.CountAsync(m =>
            m.RecipientId == UserId &&
            !m.IsRead &&
            !m.RecipientDeleted);
        var incomingFriendRequests = await _context.Friendships.CountAsync(f =>
            f.AddresseeId == UserId &&
            f.Status == FriendshipStatus.Pending);

        return Ok(new NotificationSummaryDto(
            unreadMessages,
            incomingFriendRequests,
            unreadMessages + incomingFriendRequests));
    }
}

public record NotificationSummaryDto(
    int UnreadMessages,
    int IncomingFriendRequests,
    int Total);
