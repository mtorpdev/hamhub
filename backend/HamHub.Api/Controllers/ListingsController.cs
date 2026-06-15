using HamHub.Domain.Entities;
using HamHub.Domain.Enums;
using HamHub.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace HamHub.Api.Controllers;

[ApiController]
[Route("api/listings")]
public class ListingsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IWebHostEnvironment _env;

    public ListingsController(ApplicationDbContext context, IWebHostEnvironment env)
    {
        _context = context;
        _env = env;
    }

    private string? UserId => User.FindFirstValue(ClaimTypes.NameIdentifier);

    // GET /api/listings?category=&search=
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int? category, [FromQuery] string? search)
    {
        var q = _context.Listings
            .Include(l => l.User)
            .Include(l => l.Images)
            .Where(l => l.IsActive && !l.IsSold)
            .AsQueryable();

        if (category.HasValue)
            q = q.Where(l => (int)l.Category == category.Value);
        if (!string.IsNullOrWhiteSpace(search))
            q = q.Where(l => l.Title.ToLower().Contains(search.ToLower()) || l.Description.ToLower().Contains(search.ToLower()));

        var listings = await q.OrderByDescending(l => l.CreatedAt).ToListAsync();
        return Ok(listings.Select(MapDto));
    }

    // GET /api/listings/my
    [HttpGet("my")]
    [Authorize]
    public async Task<IActionResult> GetMine()
    {
        var listings = await _context.Listings
            .Include(l => l.User)
            .Include(l => l.Images)
            .Where(l => l.UserId == UserId)
            .OrderByDescending(l => l.CreatedAt)
            .ToListAsync();
        return Ok(listings.Select(MapDto));
    }

    // GET /api/listings/{id}
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var listing = await _context.Listings
            .Include(l => l.User)
            .Include(l => l.Images.OrderBy(i => i.Order))
            .FirstOrDefaultAsync(l => l.Id == id);
        if (listing == null) return NotFound();
        return Ok(MapDto(listing));
    }

    // POST /api/listings
    [HttpPost]
    [Authorize]
    public async Task<IActionResult> Create([FromBody] CreateListingRequest req)
    {
        var listing = new Listing
        {
            UserId = UserId!,
            Title = req.Title,
            Description = req.Description,
            Price = req.Price,
            Currency = req.Currency ?? "DKK",
            Category = (ListingCategory)req.Category,
            Condition = (ListingCondition)req.Condition,
        };
        _context.Listings.Add(listing);
        await _context.SaveChangesAsync();

        var created = await _context.Listings
            .Include(l => l.User)
            .Include(l => l.Images)
            .FirstAsync(l => l.Id == listing.Id);
        return CreatedAtAction(nameof(GetById), new { id = listing.Id }, MapDto(created));
    }

    // PUT /api/listings/{id}
    [HttpPut("{id:int}")]
    [Authorize]
    public async Task<IActionResult> Update(int id, [FromBody] CreateListingRequest req)
    {
        var listing = await _context.Listings.Include(l => l.User).Include(l => l.Images).FirstOrDefaultAsync(l => l.Id == id);
        if (listing == null) return NotFound();
        if (listing.UserId != UserId) return Forbid();

        listing.Title = req.Title;
        listing.Description = req.Description;
        listing.Price = req.Price;
        listing.Currency = req.Currency ?? "DKK";
        listing.Category = (ListingCategory)req.Category;
        listing.Condition = (ListingCondition)req.Condition;
        listing.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return Ok(MapDto(listing));
    }

    // POST /api/listings/{id}/sold
    [HttpPost("{id:int}/sold")]
    [Authorize]
    public async Task<IActionResult> MarkSold(int id)
    {
        var listing = await _context.Listings.FindAsync(id);
        if (listing == null) return NotFound();
        if (listing.UserId != UserId) return Forbid();
        listing.IsSold = true;
        listing.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    // DELETE /api/listings/{id}
    [HttpDelete("{id:int}")]
    [Authorize]
    public async Task<IActionResult> Delete(int id)
    {
        var listing = await _context.Listings.Include(l => l.Images).FirstOrDefaultAsync(l => l.Id == id);
        if (listing == null) return NotFound();
        if (listing.UserId != UserId) return Forbid();

        // Delete image files
        foreach (var img in listing.Images)
            DeleteImageFile("listings", img.FileName);

        _context.Listings.Remove(listing);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    // POST /api/listings/{id}/images
    [HttpPost("{id:int}/images")]
    [Authorize]
    public async Task<IActionResult> UploadImage(int id, IFormFile file)
    {
        var listing = await _context.Listings.Include(l => l.Images).FirstOrDefaultAsync(l => l.Id == id);
        if (listing == null) return NotFound();
        if (listing.UserId != UserId) return Forbid();
        if (listing.Images.Count >= 8) return BadRequest("Maks 8 billeder per annonce");

        if (!IsAllowedImage(file.ContentType))
            return BadRequest("Kun JPG, PNG og WEBP er tilladt");

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var fileName = $"{Guid.NewGuid()}{ext}";
        var uploadPath = Path.Combine(GetUploadsDir("listings"), fileName);

        await using var stream = System.IO.File.Create(uploadPath);
        await file.CopyToAsync(stream);

        var image = new ListingImage
        {
            ListingId = id,
            FileName = fileName,
            Order = listing.Images.Count,
        };
        _context.ListingImages.Add(image);
        await _context.SaveChangesAsync();

        return Ok(new { id = image.Id, url = $"/uploads/listings/{fileName}" });
    }

    // DELETE /api/listings/{id}/images/{imageId}
    [HttpDelete("{id:int}/images/{imageId:int}")]
    [Authorize]
    public async Task<IActionResult> DeleteImage(int id, int imageId)
    {
        var listing = await _context.Listings.FirstOrDefaultAsync(l => l.Id == id);
        if (listing == null) return NotFound();
        if (listing.UserId != UserId) return Forbid();

        var image = await _context.ListingImages.FirstOrDefaultAsync(i => i.Id == imageId && i.ListingId == id);
        if (image == null) return NotFound();

        DeleteImageFile("listings", image.FileName);
        _context.ListingImages.Remove(image);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    private static readonly string[] AllowedTypes = ["image/jpeg", "image/png", "image/webp"];
    private static bool IsAllowedImage(string contentType) => AllowedTypes.Contains(contentType.ToLowerInvariant());

    private string GetUploadsDir(string sub)
    {
        var root = Path.Combine(_env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"), "uploads", sub);
        Directory.CreateDirectory(root);
        return root;
    }

    private void DeleteImageFile(string sub, string fileName)
    {
        var path = Path.Combine(GetUploadsDir(sub), fileName);
        if (System.IO.File.Exists(path)) System.IO.File.Delete(path);
    }

    private static object MapDto(Listing l) => new
    {
        l.Id,
        l.UserId,
        SellerCallsign = l.User?.Callsign,
        SellerEmail = l.User?.Email,
        l.Title,
        l.Description,
        l.Price,
        l.Currency,
        Category = (int)l.Category,
        CategoryName = l.Category.ToString(),
        Condition = (int)l.Condition,
        ConditionName = l.Condition.ToString(),
        l.IsActive,
        l.IsSold,
        Images = l.Images.OrderBy(i => i.Order).Select(i => new { i.Id, Url = $"/uploads/listings/{i.FileName}" }),
        l.CreatedAt,
        l.UpdatedAt,
    };
}

public record CreateListingRequest(string Title, string Description, decimal Price, string? Currency, int Category, int Condition);
