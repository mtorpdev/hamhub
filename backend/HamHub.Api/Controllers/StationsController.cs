using AutoMapper;
using HamHub.Application.Stations.DTOs;
using HamHub.Domain.Entities;
using HamHub.Domain.Enums;
using HamHub.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace HamHub.Api.Controllers;

[ApiController]
[Route("api/stations")]
public class StationsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IMapper _mapper;
    private readonly IWebHostEnvironment _env;

    public StationsController(ApplicationDbContext context, IMapper mapper, IWebHostEnvironment env)
    {
        _context = context;
        _mapper = mapper;
        _env = env;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var stations = await _context.StationProfiles
            .Include(s => s.Images)
            .Where(s => s.Visibility == ProfileVisibility.Public)
            .ToListAsync();
        return Ok(stations.Select(s => _mapper.Map<StationDto>(s)));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var station = await _context.StationProfiles
            .Include(s => s.Images)
            .FirstOrDefaultAsync(s => s.Id == id);
        if (station == null) return NotFound();
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var canView = station.Visibility == ProfileVisibility.Public
            || (station.Visibility == ProfileVisibility.MembersOnly && userId != null)
            || station.UserId == userId
            || User.IsInRole("Admin");
        if (!canView) return NotFound();
        return Ok(_mapper.Map<StationDto>(station));
    }

    [HttpGet("my")]
    [Authorize]
    public async Task<IActionResult> GetMine()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var stations = await _context.StationProfiles
            .Include(s => s.Images)
            .Where(s => s.UserId == userId)
            .ToListAsync();
        return Ok(stations.Select(s => _mapper.Map<StationDto>(s)));
    }

    [HttpPost]
    [Authorize]
    public async Task<IActionResult> Create([FromBody] CreateStationDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var station = _mapper.Map<StationProfile>(dto);
        station.UserId = userId;
        _context.StationProfiles.Add(station);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = station.Id }, _mapper.Map<StationDto>(station));
    }

    [HttpPut("{id}")]
    [Authorize]
    public async Task<IActionResult> Update(int id, [FromBody] CreateStationDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var station = await _context.StationProfiles.FindAsync(id);
        if (station == null) return NotFound();
        if (station.UserId != userId) return Forbid();

        station.Name = dto.Name;
        station.Callsign = dto.Callsign;
        station.RadioEquipment = dto.RadioEquipment;
        station.AntennaDescription = dto.AntennaDescription;
        station.PowerOutput = dto.PowerOutput;
        station.Location = dto.Location;
        station.GridLocator = dto.GridLocator;
        station.StationType = dto.StationType;
        station.Description = dto.Description;
        station.Visibility = dto.Visibility;
        station.SupportedModes = dto.SupportedModes ?? new();
        station.SupportedBands = dto.SupportedBands ?? new();

        await _context.SaveChangesAsync();
        var updated = await _context.StationProfiles
            .Include(s => s.Images)
            .FirstAsync(s => s.Id == id);
        return Ok(_mapper.Map<StationDto>(updated));
    }

    [HttpDelete("{id}")]
    [Authorize]
    public async Task<IActionResult> Delete(int id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var station = await _context.StationProfiles
            .Include(s => s.Images)
            .FirstOrDefaultAsync(s => s.Id == id);
        if (station == null) return NotFound();
        if (station.UserId != userId && !User.IsInRole("Admin")) return Forbid();

        foreach (var image in station.Images) DeleteImageFile(image.FileName);
        var usersWithDefaultStation = await _context.Users
            .Where(u => u.DefaultStationId == station.Id)
            .ToListAsync();
        foreach (var user in usersWithDefaultStation)
            user.DefaultStationId = null;

        _context.StationProfiles.Remove(station);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id:int}/images")]
    [Authorize]
    public async Task<IActionResult> UploadImage(int id, IFormFile file)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var station = await _context.StationProfiles
            .Include(s => s.Images)
            .FirstOrDefaultAsync(s => s.Id == id);
        if (station == null) return NotFound();
        if (station.UserId != userId) return Forbid();
        if (station.Images.Count >= 8) return BadRequest("Maks 8 billeder per station");
        if (file.Length <= 0) return BadRequest("Billedet er tomt");
        if (!IsAllowedImage(file.ContentType)) return BadRequest("Kun JPG, PNG og WEBP er tilladt");

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var fileName = $"{Guid.NewGuid()}{ext}";
        var uploadPath = Path.Combine(GetUploadsDir(), fileName);

        await using var stream = System.IO.File.Create(uploadPath);
        await file.CopyToAsync(stream);

        var image = new StationImage
        {
            StationProfileId = id,
            FileName = fileName,
            Order = station.Images.Count,
        };
        _context.StationImages.Add(image);
        await _context.SaveChangesAsync();

        return Ok(new StationImageDto(image.Id, $"/uploads/stations/{fileName}"));
    }

    [HttpDelete("{id:int}/images/{imageId:int}")]
    [Authorize]
    public async Task<IActionResult> DeleteImage(int id, int imageId)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var station = await _context.StationProfiles.FirstOrDefaultAsync(s => s.Id == id);
        if (station == null) return NotFound();
        if (station.UserId != userId) return Forbid();

        var image = await _context.StationImages.FirstOrDefaultAsync(i => i.Id == imageId && i.StationProfileId == id);
        if (image == null) return NotFound();

        DeleteImageFile(image.FileName);
        _context.StationImages.Remove(image);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    private static readonly string[] AllowedTypes = ["image/jpeg", "image/png", "image/webp"];
    private static bool IsAllowedImage(string contentType) => AllowedTypes.Contains(contentType.ToLowerInvariant());

    private string GetUploadsDir()
    {
        var root = Path.Combine(_env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"), "uploads", "stations");
        Directory.CreateDirectory(root);
        return root;
    }

    private void DeleteImageFile(string fileName)
    {
        var path = Path.Combine(GetUploadsDir(), fileName);
        if (System.IO.File.Exists(path)) System.IO.File.Delete(path);
    }
}
