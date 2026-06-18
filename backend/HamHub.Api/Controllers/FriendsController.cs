using System.Security.Claims;
using HamHub.Api.Hubs;
using HamHub.Domain.Entities;
using HamHub.Domain.Enums;
using HamHub.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace HamHub.Api.Controllers;

[ApiController]
[Route("api/friends")]
[Authorize]
public class FriendsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IHubContext<PrivateMessagesHub>? _hubContext;

    public FriendsController(ApplicationDbContext context, IHubContext<PrivateMessagesHub>? hubContext = null)
    {
        _context = context;
        _hubContext = hubContext;
    }

    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpGet]
    public async Task<IActionResult> GetFriends()
    {
        var friendships = await BaseFriendshipQuery()
            .Where(f => f.Status == FriendshipStatus.Accepted && (f.RequesterId == UserId || f.AddresseeId == UserId))
            .OrderBy(f => f.RequesterId == UserId ? f.Addressee!.Callsign ?? f.Addressee.Email : f.Requester!.Callsign ?? f.Requester.Email)
            .ToListAsync();

        return Ok(friendships.Select(MapDto).ToList());
    }

    [HttpGet("requests")]
    public async Task<IActionResult> GetRequests()
    {
        var incoming = await BaseFriendshipQuery()
            .Where(f => f.Status == FriendshipStatus.Pending && f.AddresseeId == UserId)
            .OrderByDescending(f => f.CreatedAt)
            .ToListAsync();
        var outgoing = await BaseFriendshipQuery()
            .Where(f => f.Status == FriendshipStatus.Pending && f.RequesterId == UserId)
            .OrderByDescending(f => f.CreatedAt)
            .ToListAsync();

        return Ok(new FriendRequestsDto(incoming.Select(MapDto).ToList(), outgoing.Select(MapDto).ToList()));
    }

    [HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] string q)
    {
        if (string.IsNullOrWhiteSpace(q)) return Ok(Array.Empty<FriendCandidateDto>());
        var normalized = q.Trim().ToLowerInvariant();

        var users = await _context.Users
            .Where(u => u.Id != UserId)
            .Where(u =>
                (u.Callsign != null && u.Callsign.ToLower().Contains(normalized)) ||
                (u.Email != null && u.Email.ToLower().Contains(normalized)) ||
                (u.FirstName != null && u.FirstName.ToLower().Contains(normalized)) ||
                (u.LastName != null && u.LastName.ToLower().Contains(normalized)))
            .OrderBy(u => u.Callsign ?? u.Email)
            .Take(20)
            .ToListAsync();

        var ids = users.Select(u => u.Id).ToList();
        var friendships = await _context.Friendships
            .Where(f => ids.Contains(f.RequesterId) || ids.Contains(f.AddresseeId))
            .Where(f => f.RequesterId == UserId || f.AddresseeId == UserId)
            .ToListAsync();

        return Ok(users.Select(user =>
        {
            var friendship = friendships.FirstOrDefault(f =>
                (f.RequesterId == UserId && f.AddresseeId == user.Id) ||
                (f.AddresseeId == UserId && f.RequesterId == user.Id));
            return new FriendCandidateDto(
                user.Id,
                user.Callsign,
                user.Email,
                FullName(user),
                user.GridLocator,
                friendship?.Status,
                friendship?.RequesterId == UserId ? "outgoing" : friendship != null ? "incoming" : null);
        }).ToList());
    }

    [HttpPost("requests")]
    public async Task<IActionResult> SendRequest([FromBody] SendFriendRequestDto request)
    {
        if (string.IsNullOrWhiteSpace(request.UserId)) return BadRequest("Bruger er påkrævet");
        if (request.UserId == UserId) return BadRequest("Du kan ikke sende venneanmodning til dig selv");

        var other = await _context.Users.FindAsync(request.UserId);
        if (other == null) return NotFound("Bruger ikke fundet");

        var existing = await FindFriendshipAsync(UserId, request.UserId);
        if (existing != null)
        {
            if (existing.Status == FriendshipStatus.Declined)
            {
                existing.RequesterId = UserId;
                existing.AddresseeId = request.UserId;
                existing.Status = FriendshipStatus.Pending;
                existing.CreatedAt = DateTime.UtcNow;
                existing.RespondedAt = null;
                await _context.SaveChangesAsync();
                var dto = MapDto(await LoadFriendshipAsync(existing.Id));
                await AddFriendRequestNotificationAsync(existing.Id, existing.AddresseeId, UserId);
                await BroadcastFriendshipChangedAsync(existing.RequesterId, existing.AddresseeId);
                return CreatedAtAction(nameof(GetRequests), new { id = existing.Id }, dto);
            }

            return BadRequest(existing.Status == FriendshipStatus.Accepted
                ? "I er allerede venner"
                : "Der findes allerede en venneanmodning");
        }

        var friendship = new Friendship
        {
            RequesterId = UserId,
            AddresseeId = request.UserId,
            Status = FriendshipStatus.Pending
        };
        _context.Friendships.Add(friendship);
        await _context.SaveChangesAsync();
        await AddFriendRequestNotificationAsync(friendship.Id, friendship.AddresseeId, UserId);
        await BroadcastFriendshipChangedAsync(friendship.RequesterId, friendship.AddresseeId);

        return CreatedAtAction(nameof(GetRequests), new { id = friendship.Id }, MapDto(await LoadFriendshipAsync(friendship.Id)));
    }

    [HttpPost("requests/{id:int}/accept")]
    public async Task<IActionResult> Accept(int id)
    {
        var friendship = await BaseFriendshipQuery().FirstOrDefaultAsync(f => f.Id == id);
        if (friendship == null) return NotFound();
        if (friendship.AddresseeId != UserId) return Forbid();
        if (friendship.Status != FriendshipStatus.Pending) return BadRequest("Anmodningen er ikke aktiv");

        friendship.Status = FriendshipStatus.Accepted;
        friendship.RespondedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        await BroadcastFriendshipChangedAsync(friendship.RequesterId, friendship.AddresseeId);
        return Ok(MapDto(friendship));
    }

    [HttpPost("requests/{id:int}/decline")]
    public async Task<IActionResult> Decline(int id)
    {
        var friendship = await BaseFriendshipQuery().FirstOrDefaultAsync(f => f.Id == id);
        if (friendship == null) return NotFound();
        if (friendship.AddresseeId != UserId) return Forbid();
        if (friendship.Status != FriendshipStatus.Pending) return BadRequest("Anmodningen er ikke aktiv");

        friendship.Status = FriendshipStatus.Declined;
        friendship.RespondedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        await BroadcastFriendshipChangedAsync(friendship.RequesterId, friendship.AddresseeId);
        return Ok(MapDto(friendship));
    }

    [HttpDelete("{friendId}")]
    public async Task<IActionResult> Remove(string friendId)
    {
        var friendship = await FindFriendshipAsync(UserId, friendId);
        if (friendship == null) return NotFound();
        if (friendship.RequesterId != UserId && friendship.AddresseeId != UserId) return Forbid();

        _context.Friendships.Remove(friendship);
        await _context.SaveChangesAsync();
        await BroadcastFriendshipChangedAsync(friendship.RequesterId, friendship.AddresseeId);
        return NoContent();
    }

    internal static bool AreFriends(ApplicationDbContext context, string userId, string otherUserId)
    {
        return context.Friendships.Any(f =>
            f.Status == FriendshipStatus.Accepted &&
            ((f.RequesterId == userId && f.AddresseeId == otherUserId) ||
             (f.RequesterId == otherUserId && f.AddresseeId == userId)));
    }

    internal static Task<bool> AreFriendsAsync(ApplicationDbContext context, string userId, string otherUserId)
    {
        return context.Friendships.AnyAsync(f =>
            f.Status == FriendshipStatus.Accepted &&
            ((f.RequesterId == userId && f.AddresseeId == otherUserId) ||
             (f.RequesterId == otherUserId && f.AddresseeId == userId)));
    }

    private IQueryable<Friendship> BaseFriendshipQuery()
    {
        return _context.Friendships
            .Include(f => f.Requester)
            .Include(f => f.Addressee);
    }

    private async Task<Friendship?> FindFriendshipAsync(string userId, string otherUserId)
    {
        return await _context.Friendships.FirstOrDefaultAsync(f =>
            (f.RequesterId == userId && f.AddresseeId == otherUserId) ||
            (f.RequesterId == otherUserId && f.AddresseeId == userId));
    }

    private async Task<Friendship> LoadFriendshipAsync(int id)
    {
        return await BaseFriendshipQuery().FirstAsync(f => f.Id == id);
    }

    private FriendshipDto MapDto(Friendship friendship)
    {
        var other = friendship.RequesterId == UserId ? friendship.Addressee : friendship.Requester;
        var direction = friendship.RequesterId == UserId ? "outgoing" : "incoming";
        return new FriendshipDto(
            friendship.Id,
            other.Id,
            other.Callsign,
            other.Email,
            FullName(other),
            other.GridLocator,
            friendship.Status,
            direction,
            friendship.CreatedAt,
            friendship.RespondedAt);
    }

    private static string? FullName(ApplicationUser user)
    {
        var name = $"{user.FirstName} {user.LastName}".Trim();
        return string.IsNullOrWhiteSpace(name) ? null : name;
    }

    private async Task AddFriendRequestNotificationAsync(int friendshipId, string userId, string requesterId)
    {
        var requester = await _context.Users.FindAsync(requesterId);
        _context.NotificationEvents.Add(new NotificationEvent
        {
            UserId = userId,
            Type = "friend-request",
            Title = $"Venneanmodning fra {requester?.Callsign ?? requester?.Email ?? "Ukendt bruger"}",
            Description = "Accepter eller afvis anmodningen",
            Href = "/messages?tab=requests",
            RelatedId = friendshipId
        });
        await _context.SaveChangesAsync();
    }

    private async Task BroadcastFriendshipChangedAsync(string requesterId, string addresseeId)
    {
        if (_hubContext == null) return;

        await _hubContext.Clients
            .Groups(PrivateMessagesHub.UserGroup(requesterId), PrivateMessagesHub.UserGroup(addresseeId))
            .SendAsync("FriendshipChanged");
        await _hubContext.Clients
            .Groups(PrivateMessagesHub.UserGroup(requesterId), PrivateMessagesHub.UserGroup(addresseeId))
            .SendAsync("NotificationSummaryChanged");
    }
}

public record SendFriendRequestDto(string UserId);

public record FriendRequestsDto(IReadOnlyList<FriendshipDto> Incoming, IReadOnlyList<FriendshipDto> Outgoing);

public record FriendshipDto(
    int Id,
    string OtherUserId,
    string? OtherCallsign,
    string? OtherEmail,
    string? OtherName,
    string? OtherGridLocator,
    FriendshipStatus Status,
    string Direction,
    DateTime CreatedAt,
    DateTime? RespondedAt);

public record FriendCandidateDto(
    string UserId,
    string? Callsign,
    string? Email,
    string? Name,
    string? GridLocator,
    FriendshipStatus? FriendshipStatus,
    string? FriendshipDirection);
