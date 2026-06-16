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

    public CommunityController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet("rooms")]
    public async Task<IActionResult> GetRooms()
    {
        var rooms = await _context.CommunityRooms
            .OrderBy(r => r.SortOrder)
            .ThenBy(r => r.Name)
            .Select(r => new CommunityRoomDto(r.Id, r.Name, r.Slug, r.Description, r.SortOrder, r.IsSystem))
            .ToListAsync();

        return Ok(rooms);
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
}

public record CommunityRoomDto(int Id, string Name, string Slug, string? Description, int SortOrder, bool IsSystem);
public record CommunityContactDto(
    string Id,
    string? Callsign,
    string? Email,
    string? Name,
    string? ProfileImageUrl,
    string? GridLocator,
    string? Country);
