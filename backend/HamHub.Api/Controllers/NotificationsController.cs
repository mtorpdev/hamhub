using System.Security.Claims;
using HamHub.Domain.Entities;
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
        return Ok(await BuildSummaryAsync());
    }

    [HttpGet("center")]
    public async Task<IActionResult> GetCenter()
    {
        var summary = await BuildSummaryAsync();
        var items = new List<NotificationItemDto>();

        var messages = await _context.Messages
            .Include(m => m.Sender)
            .Where(m => m.RecipientId == UserId && !m.IsRead && !m.RecipientDeleted)
            .OrderByDescending(m => m.CreatedAt)
            .Take(10)
            .ToListAsync();
        items.AddRange(messages.Select(m => new NotificationItemDto(
            $"message-{m.Id}",
            "message",
            $"Ny besked fra {DisplayName(m.Sender)}",
            string.IsNullOrWhiteSpace(m.Subject) ? "Privat besked" : m.Subject,
            m.CreatedAt,
            $"/messages/{m.Id}",
            m.Id,
            null,
            null,
            null)));

        var friendRequests = await _context.Friendships
            .Include(f => f.Requester)
            .Where(f => f.AddresseeId == UserId && f.Status == FriendshipStatus.Pending)
            .OrderByDescending(f => f.CreatedAt)
            .Take(10)
            .ToListAsync();
        items.AddRange(friendRequests.Select(f => new NotificationItemDto(
            $"friend-request-{f.Id}",
            "friend-request",
            $"Venneanmodning fra {DisplayName(f.Requester)}",
            "Accepter eller afvis anmodningen",
            f.CreatedAt,
            "/messages?tab=requests",
            f.Id,
            null,
            "Accepter",
            "Afvis")));

        var invitations = await _context.CommunityGroupInvitations
            .Include(i => i.CommunityRoom)
            .Include(i => i.Inviter)
            .Where(i => i.InviteeId == UserId && i.Status == CommunityGroupRequestStatus.Pending)
            .OrderByDescending(i => i.CreatedAt)
            .Take(10)
            .ToListAsync();
        items.AddRange(invitations.Select(i => new NotificationItemDto(
            $"group-invitation-{i.Id}",
            "group-invitation",
            $"Invitation til {i.CommunityRoom.Name}",
            $"Inviteret af {DisplayName(i.Inviter)}",
            i.CreatedAt,
            $"/community/groups/{i.CommunityRoom.Slug}",
            i.Id,
            i.CommunityRoomId,
            "Accepter",
            "Afvis")));

        var joinRequests = await _context.CommunityGroupJoinRequests
            .Include(r => r.CommunityRoom)
            .Include(r => r.User)
            .Where(r =>
                r.Status == CommunityGroupRequestStatus.Pending &&
                _context.CommunityGroupMemberships.Any(m =>
                    m.CommunityRoomId == r.CommunityRoomId &&
                    m.UserId == UserId &&
                    (m.Role == CommunityGroupRole.Owner || m.Role == CommunityGroupRole.Admin)))
            .OrderByDescending(r => r.CreatedAt)
            .Take(10)
            .ToListAsync();
        items.AddRange(joinRequests.Select(r => new NotificationItemDto(
            $"group-join-request-{r.Id}",
            "group-join-request",
            $"Join request til {r.CommunityRoom.Name}",
            $"{DisplayName(r.User)} vil være medlem",
            r.CreatedAt,
            $"/community/groups/{r.CommunityRoom.Slug}",
            r.Id,
            r.CommunityRoomId,
            "Accepter",
            "Afvis")));

        return Ok(new NotificationCenterDto(
            summary,
            items
                .OrderByDescending(i => i.CreatedAt)
                .Take(30)
                .ToList()));
    }

    private async Task<NotificationSummaryDto> BuildSummaryAsync()
    {
        var unreadMessages = await _context.Messages.CountAsync(m =>
            m.RecipientId == UserId &&
            !m.IsRead &&
            !m.RecipientDeleted);
        var incomingFriendRequests = await _context.Friendships.CountAsync(f =>
            f.AddresseeId == UserId &&
            f.Status == FriendshipStatus.Pending);
        var groupInvitations = await _context.CommunityGroupInvitations.CountAsync(i =>
            i.InviteeId == UserId &&
            i.Status == CommunityGroupRequestStatus.Pending);
        var groupJoinRequests = await _context.CommunityGroupJoinRequests.CountAsync(r =>
            r.Status == CommunityGroupRequestStatus.Pending &&
            _context.CommunityGroupMemberships.Any(m =>
                m.CommunityRoomId == r.CommunityRoomId &&
                m.UserId == UserId &&
                (m.Role == CommunityGroupRole.Owner || m.Role == CommunityGroupRole.Admin)));

        return new NotificationSummaryDto(
            unreadMessages,
            incomingFriendRequests,
            groupInvitations,
            groupJoinRequests,
            unreadMessages + incomingFriendRequests + groupInvitations + groupJoinRequests);
    }

    private static string DisplayName(ApplicationUser? user)
    {
        return user?.Callsign ?? user?.Email ?? "Ukendt bruger";
    }
}

public record NotificationSummaryDto(
    int UnreadMessages,
    int IncomingFriendRequests,
    int GroupInvitations,
    int GroupJoinRequests,
    int Total);

public record NotificationCenterDto(
    NotificationSummaryDto Summary,
    IReadOnlyList<NotificationItemDto> Items);

public record NotificationItemDto(
    string Id,
    string Type,
    string Title,
    string Description,
    DateTime CreatedAt,
    string Href,
    int? RelatedId,
    int? GroupId,
    string? PrimaryAction,
    string? SecondaryAction);
