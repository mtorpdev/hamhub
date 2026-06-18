using HamHub.Api.Services;
using HamHub.Domain.Entities;
using HamHub.Domain.Enums;
using HamHub.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace HamHub.Api.Controllers;

[ApiController]
[Route("api/community")]
public class CommunityController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly CommunityPresenceTracker _presence;

    public CommunityController(ApplicationDbContext context, CommunityPresenceTracker presence)
    {
        _context = context;
        _presence = presence;
    }

    private string? UserId => User.FindFirstValue(ClaimTypes.NameIdentifier);

    [HttpGet("rooms")]
    public async Task<IActionResult> GetRooms()
    {
        var userId = UserId;
        var rooms = await VisibleCommunityGroups(userId)
            .Where(r => !r.Slug.StartsWith("forum-"))
            .OrderBy(r => r.SortOrder)
            .ThenBy(r => r.Name)
            .ToListAsync();

        return Ok(rooms.Select(r => MapGroupDto(r, userId)).ToList());
    }

    [HttpGet("groups")]
    [Authorize]
    public async Task<IActionResult> GetGroups()
    {
        var userId = UserId;
        var groups = await VisibleCommunityGroups(userId)
            .Where(r => !r.Slug.StartsWith("forum-"))
            .OrderByDescending(r => r.Memberships.Any(m => m.UserId == userId))
            .ThenBy(r => r.SortOrder)
            .ThenBy(r => r.Name)
            .ToListAsync();

        return Ok(groups.Select(r => MapGroupDto(r, userId)).ToList());
    }

    [HttpGet("forum-rooms")]
    public async Task<IActionResult> GetForumRooms()
    {
        var rooms = await _context.CommunityRooms
            .Where(r => r.Slug.StartsWith("forum-"))
            .OrderBy(r => r.SortOrder)
            .ThenBy(r => r.Name)
            .Select(r => new CommunityRoomDto(r.Id, r.Name, r.Slug, r.Description, r.SortOrder, r.IsSystem))
            .ToListAsync();

        return Ok(rooms);
    }

    [HttpPost("groups")]
    [Authorize]
    public async Task<IActionResult> CreateGroup([FromBody] CreateCommunityGroupRequest request)
    {
        var name = (request.Name ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(name)) return BadRequest("Gruppenavn er påkrævet");
        if (name.Length > 120) return BadRequest("Gruppenavn må maks være 120 tegn");

        var slugBase = Slugify(name);
        var slug = slugBase;
        var suffix = 2;
        while (await _context.CommunityRooms.AnyAsync(r => r.Slug == slug))
        {
            slug = $"{slugBase}-{suffix++}";
        }

        var group = new CommunityRoom
        {
            Name = name,
            Slug = slug,
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            SortOrder = 100,
            IsSystem = false,
            OwnerId = UserId!,
            Visibility = request.Visibility,
            AllowJoinRequests = request.Visibility != CommunityGroupVisibility.InviteOnly && request.AllowJoinRequests
        };
        _context.CommunityRooms.Add(group);
        await _context.SaveChangesAsync();

        _context.CommunityGroupMemberships.Add(new CommunityGroupMembership
        {
            CommunityRoomId = group.Id,
            UserId = UserId!,
            Role = CommunityGroupRole.Owner
        });
        await _context.SaveChangesAsync();

        group.Memberships = await _context.CommunityGroupMemberships.Where(m => m.CommunityRoomId == group.Id).ToListAsync();
        return Ok(MapGroupDto(group, UserId));
    }

    [HttpPost("groups/{groupId:int}/join-requests")]
    [Authorize]
    public async Task<IActionResult> RequestToJoin(int groupId)
    {
        var group = await _context.CommunityRooms
            .Include(g => g.Memberships)
            .FirstOrDefaultAsync(g => g.Id == groupId && !g.Slug.StartsWith("forum-"));
        if (group == null) return NotFound();
        if (group.Memberships.Any(m => m.UserId == UserId)) return BadRequest("Du er allerede medlem");
        if (group.Visibility == CommunityGroupVisibility.InviteOnly || !group.AllowJoinRequests) return BadRequest("Gruppen er kun for inviterede");

        var existing = await _context.CommunityGroupJoinRequests
            .FirstOrDefaultAsync(r => r.CommunityRoomId == groupId && r.UserId == UserId && r.Status == CommunityGroupRequestStatus.Pending);
        if (existing != null) return Ok();

        _context.CommunityGroupJoinRequests.Add(new CommunityGroupJoinRequest
        {
            CommunityRoomId = groupId,
            UserId = UserId!,
            Status = CommunityGroupRequestStatus.Pending
        });
        await _context.SaveChangesAsync();
        return Ok();
    }

    [HttpGet("groups/{groupId:int}/join-requests")]
    [Authorize]
    public async Task<IActionResult> GetJoinRequests(int groupId)
    {
        if (!await CanManageGroup(groupId, UserId!)) return Forbid();
        var requests = await _context.CommunityGroupJoinRequests
            .Include(r => r.User)
            .Where(r => r.CommunityRoomId == groupId && r.Status == CommunityGroupRequestStatus.Pending)
            .OrderBy(r => r.CreatedAt)
            .Select(r => new CommunityGroupJoinRequestDto(
                r.Id,
                r.CommunityRoomId,
                r.UserId,
                r.User.Callsign,
                r.User.Email,
                r.Status,
                r.CreatedAt))
            .ToListAsync();
        return Ok(requests);
    }

    [HttpPost("groups/{groupId:int}/join-requests/{requestId:int}/approve")]
    [Authorize]
    public async Task<IActionResult> ApproveJoinRequest(int groupId, int requestId)
    {
        if (!await CanManageGroup(groupId, UserId!)) return Forbid();
        var request = await _context.CommunityGroupJoinRequests.FirstOrDefaultAsync(r => r.Id == requestId && r.CommunityRoomId == groupId);
        if (request == null) return NotFound();
        if (request.Status != CommunityGroupRequestStatus.Pending) return BadRequest("Anmodningen er allerede behandlet");

        request.Status = CommunityGroupRequestStatus.Approved;
        request.ResolvedAt = DateTime.UtcNow;
        if (!await _context.CommunityGroupMemberships.AnyAsync(m => m.CommunityRoomId == groupId && m.UserId == request.UserId))
        {
            _context.CommunityGroupMemberships.Add(new CommunityGroupMembership
            {
                CommunityRoomId = groupId,
                UserId = request.UserId,
                Role = CommunityGroupRole.Member
            });
        }
        await _context.SaveChangesAsync();
        return Ok();
    }

    [HttpPost("groups/{groupId:int}/invite")]
    [Authorize]
    public async Task<IActionResult> InviteToGroup(int groupId, [FromBody] InviteToCommunityGroupRequest request)
    {
        if (!await CanManageGroup(groupId, UserId!)) return Forbid();
        if (!await _context.Users.AnyAsync(u => u.Id == request.UserId)) return NotFound("Bruger ikke fundet");
        if (await _context.CommunityGroupMemberships.AnyAsync(m => m.CommunityRoomId == groupId && m.UserId == request.UserId)) return BadRequest("Brugeren er allerede medlem");

        var invite = await _context.CommunityGroupInvitations
            .FirstOrDefaultAsync(i => i.CommunityRoomId == groupId && i.InviteeId == request.UserId && i.Status == CommunityGroupRequestStatus.Pending);
        if (invite == null)
        {
            _context.CommunityGroupInvitations.Add(new CommunityGroupInvitation
            {
                CommunityRoomId = groupId,
                InviterId = UserId!,
                InviteeId = request.UserId,
                Status = CommunityGroupRequestStatus.Pending
            });
            await _context.SaveChangesAsync();
        }
        return Ok();
    }

    [HttpGet("group-invitations")]
    [Authorize]
    public async Task<IActionResult> GetMyGroupInvitations()
    {
        var invitations = await _context.CommunityGroupInvitations
            .Include(i => i.CommunityRoom)
            .Include(i => i.Inviter)
            .Where(i => i.InviteeId == UserId && i.Status == CommunityGroupRequestStatus.Pending)
            .OrderByDescending(i => i.CreatedAt)
            .Select(i => new CommunityGroupInvitationDto(
                i.Id,
                i.CommunityRoomId,
                i.CommunityRoom.Name,
                i.Inviter.Callsign ?? i.Inviter.Email,
                i.CreatedAt))
            .ToListAsync();
        return Ok(invitations);
    }

    [HttpPost("group-invitations/{invitationId:int}/accept")]
    [Authorize]
    public async Task<IActionResult> AcceptGroupInvitation(int invitationId)
    {
        var invitation = await _context.CommunityGroupInvitations.FirstOrDefaultAsync(i => i.Id == invitationId && i.InviteeId == UserId);
        if (invitation == null) return NotFound();
        if (invitation.Status != CommunityGroupRequestStatus.Pending) return BadRequest("Invitationen er allerede behandlet");

        invitation.Status = CommunityGroupRequestStatus.Approved;
        invitation.ResolvedAt = DateTime.UtcNow;
        if (!await _context.CommunityGroupMemberships.AnyAsync(m => m.CommunityRoomId == invitation.CommunityRoomId && m.UserId == UserId))
        {
            _context.CommunityGroupMemberships.Add(new CommunityGroupMembership
            {
                CommunityRoomId = invitation.CommunityRoomId,
                UserId = UserId!,
                Role = CommunityGroupRole.Member
            });
        }
        await _context.SaveChangesAsync();
        return Ok();
    }

    [HttpGet("contacts")]
    [Authorize]
    public async Task<IActionResult> GetContacts([FromQuery] int limit = 50)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var friendIds = await _context.Friendships
            .Where(f => f.Status == HamHub.Domain.Enums.FriendshipStatus.Accepted && (f.RequesterId == userId || f.AddresseeId == userId))
            .Select(f => f.RequesterId == userId ? f.AddresseeId : f.RequesterId)
            .ToListAsync();

        var contacts = await _context.Users
            .Where(u => friendIds.Contains(u.Id))
            .OrderBy(u => u.Callsign ?? u.Email)
            .Take(Math.Clamp(limit, 1, 100))
            .Select(u => new CommunityContactDto(
                u.Id,
                u.Callsign,
                u.Email,
                (u.FirstName + " " + u.LastName).Trim(),
                u.ProfileImageUrl,
                u.GridLocator,
                u.Country))
            .ToListAsync();

        return Ok(contacts);
    }

    [HttpGet("online")]
    [Authorize]
    public async Task<IActionResult> GetOnlineUsers([FromQuery] int limit = 40)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();

        var onlineIds = _presence.OnlineUserIds
            .Where(id => id != userId)
            .Take(Math.Clamp(limit, 1, 100))
            .ToArray();

        if (onlineIds.Length == 0) return Ok(Array.Empty<CommunityOnlineUserDto>());

        var friendships = await _context.Friendships
            .Where(f => f.RequesterId == userId || f.AddresseeId == userId)
            .ToListAsync();
        var friendshipByUserId = friendships.ToDictionary(
            f => f.RequesterId == userId ? f.AddresseeId : f.RequesterId,
            f => f);

        var users = await _context.Users
            .Where(u => onlineIds.Contains(u.Id))
            .OrderBy(u => u.Callsign ?? u.Email)
            .Select(u => new
            {
                u.Id,
                u.Callsign,
                u.Email,
                Name = (u.FirstName + " " + u.LastName).Trim(),
                u.ProfileImageUrl,
                u.GridLocator,
                u.Country
            })
            .ToListAsync();

        return Ok(users.Select(u =>
        {
            friendshipByUserId.TryGetValue(u.Id, out var friendship);
            return new CommunityOnlineUserDto(
                u.Id,
                u.Callsign,
                u.Email,
                string.IsNullOrWhiteSpace(u.Name) ? null : u.Name,
                u.ProfileImageUrl,
                u.GridLocator,
                u.Country,
                friendship?.Status == FriendshipStatus.Accepted,
                friendship?.Status,
                friendship is null ? null : friendship.RequesterId == userId ? "outgoing" : "incoming");
        }).ToList());
    }

    private IQueryable<CommunityRoom> VisibleCommunityGroups(string? userId)
    {
        return _context.CommunityRooms
            .Include(r => r.Memberships)
            .Include(r => r.JoinRequests.Where(j => j.Status == CommunityGroupRequestStatus.Pending))
            .Where(r =>
                r.Visibility != CommunityGroupVisibility.InviteOnly ||
                (userId != null && r.Memberships.Any(m => m.UserId == userId)));
    }

    private async Task<bool> CanManageGroup(int groupId, string userId)
    {
        return await _context.CommunityGroupMemberships.AnyAsync(m =>
            m.CommunityRoomId == groupId &&
            m.UserId == userId &&
            (m.Role == CommunityGroupRole.Owner || m.Role == CommunityGroupRole.Admin));
    }

    private static CommunityGroupDto MapGroupDto(CommunityRoom room, string? userId)
    {
        var membership = userId == null ? null : room.Memberships.FirstOrDefault(m => m.UserId == userId);
        var status = membership?.Role switch
        {
            CommunityGroupRole.Owner => CommunityGroupMembershipStatus.Owner,
            CommunityGroupRole.Admin => CommunityGroupMembershipStatus.Admin,
            CommunityGroupRole.Member => CommunityGroupMembershipStatus.Member,
            _ => room.IsSystem && room.Visibility == CommunityGroupVisibility.Public
                ? CommunityGroupMembershipStatus.Member
                : userId != null && room.JoinRequests.Any(r => r.UserId == userId) ? CommunityGroupMembershipStatus.Pending : CommunityGroupMembershipStatus.None
        };

        return new CommunityGroupDto(
            room.Id,
            room.Name,
            room.Slug,
            room.Description,
            room.SortOrder,
            room.IsSystem,
            room.Visibility,
            room.AllowJoinRequests,
            room.OwnerId,
            room.Memberships.Count,
            status);
    }

    private static string Slugify(string name)
    {
        var chars = name.Trim().ToLowerInvariant()
            .Select(ch => char.IsLetterOrDigit(ch) ? ch : '-')
            .ToArray();
        var slug = string.Join('-', new string(chars).Split('-', StringSplitOptions.RemoveEmptyEntries));
        return string.IsNullOrWhiteSpace(slug) ? $"gruppe-{Guid.NewGuid():N}"[..12] : slug;
    }
}

public record CommunityRoomDto(int Id, string Name, string Slug, string? Description, int SortOrder, bool IsSystem);
public record CommunityGroupDto(
    int Id,
    string Name,
    string Slug,
    string? Description,
    int SortOrder,
    bool IsSystem,
    CommunityGroupVisibility Visibility,
    bool AllowJoinRequests,
    string? OwnerId,
    int MemberCount,
    CommunityGroupMembershipStatus MembershipStatus);
public record CreateCommunityGroupRequest(string Name, string? Description, CommunityGroupVisibility Visibility, bool AllowJoinRequests);
public record InviteToCommunityGroupRequest(string UserId);
public record CommunityGroupJoinRequestDto(
    int Id,
    int CommunityRoomId,
    string UserId,
    string? Callsign,
    string? Email,
    CommunityGroupRequestStatus Status,
    DateTime CreatedAt);
public record CommunityGroupInvitationDto(int Id, int CommunityRoomId, string GroupName, string? InviterCallsign, DateTime CreatedAt);
public record CommunityContactDto(
    string Id,
    string? Callsign,
    string? Email,
    string? Name,
    string? ProfileImageUrl,
    string? GridLocator,
    string? Country);

public record CommunityOnlineUserDto(
    string Id,
    string? Callsign,
    string? Email,
    string? Name,
    string? ProfileImageUrl,
    string? GridLocator,
    string? Country,
    bool IsFriend,
    FriendshipStatus? FriendshipStatus,
    string? FriendshipDirection);
