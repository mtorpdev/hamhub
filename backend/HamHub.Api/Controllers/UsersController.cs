using AutoMapper;
using HamHub.Application.Users.DTOs;
using HamHub.Domain.Entities;
using HamHub.Infrastructure.Persistence;
using HamHub.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.RegularExpressions;

namespace HamHub.Api.Controllers;

[ApiController]
[Route("api/users")]
public class UsersController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ApplicationDbContext _context;
    private readonly IMapper _mapper;
    private readonly IDataProtector _protector;
    private readonly QrzClient _qrzClient;

    public UsersController(
        UserManager<ApplicationUser> userManager,
        ApplicationDbContext context,
        IMapper mapper,
        IDataProtectionProvider dataProtectionProvider,
        QrzClient qrzClient)
    {
        _userManager = userManager;
        _context = context;
        _mapper = mapper;
        _protector = dataProtectionProvider.CreateProtector("QrzApiKey");
        _qrzClient = qrzClient;
    }

    [HttpGet]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAll()
    {
        var users = await _context.Users.ToListAsync();
        return Ok(users.Select(u => _mapper.Map<UserDto>(u)));
    }

    [HttpGet("search")]
    public async Task<IActionResult> SearchByCallsign([FromQuery] string callsign)
    {
        if (string.IsNullOrWhiteSpace(callsign)) return BadRequest("callsign query parameter is required");
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Callsign != null && u.Callsign.ToLower() == callsign.ToLower());
        if (user == null) return NotFound();
        return Ok(_mapper.Map<UserDto>(user));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(string id)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null) return NotFound();
        return Ok(_mapper.Map<UserDto>(user));
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> GetMe()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var user = await _context.Users.FindAsync(userId);
        if (user == null) return NotFound();
        return Ok(_mapper.Map<UserDto>(user));
    }

    [HttpPut("me")]
    [Authorize]
    public async Task<IActionResult> UpdateMe([FromBody] UpdateUserDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var user = await _context.Users.FindAsync(userId);
        if (user == null) return NotFound();

        user.Callsign = dto.Callsign;
        user.FirstName = dto.FirstName;
        user.LastName = dto.LastName;
        user.Country = dto.Country;
        user.GridLocator = dto.GridLocator;
        user.LicenseClass = dto.LicenseClass;
        user.ProfileDescription = dto.ProfileDescription;
        user.ProfileImageUrl = dto.ProfileImageUrl;
        user.Visibility = dto.Visibility;

        await _context.SaveChangesAsync();
        return Ok(_mapper.Map<UserDto>(user));
    }

    [HttpPut("me/qrz-key")]
    [Authorize]
    public async Task<IActionResult> SaveQrzKey([FromBody] SaveQrzKeyDto dto, CancellationToken ct)
    {
        // Validate format
        if (!Regex.IsMatch(dto.ApiKey ?? "", @"^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$"))
            return BadRequest("Ugyldig API nøgle format. Forventet: XXXX-XXXX-XXXX-XXXX");

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return NotFound();

        // Verify key by doing a test lookup with the user's own callsign
        if (!string.IsNullOrWhiteSpace(user.Callsign))
        {
            try
            {
                var result = await _qrzClient.LookupCallsignAsync(user.Callsign, dto.ApiKey!, ct);
                if (result == null)
                    return BadRequest($"API nøglen er gyldig men kaldesignalet {user.Callsign} blev ikke fundet på QRZ");
            }
            catch (QrzApiException ex)
            {
                return BadRequest($"QRZ API fejl: {ex.Message}");
            }
            catch (Exception)
            {
                return BadRequest("Kunne ikke forbinde til QRZ. Kontroller API nøglen.");
            }
        }

        user.QrzApiKey = _protector.Protect(dto.ApiKey!);
        await _userManager.UpdateAsync(user);

        return Ok(new { callsign = user.Callsign });
    }
}

public record SaveQrzKeyDto(string? ApiKey);
