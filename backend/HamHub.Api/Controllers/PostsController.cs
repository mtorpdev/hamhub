using HamHub.Domain.Entities;
using HamHub.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace HamHub.Api.Controllers;

[ApiController]
[Route("api/posts")]
public class PostsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IWebHostEnvironment _env;

    public PostsController(ApplicationDbContext context, IWebHostEnvironment env)
    {
        _context = context;
        _env = env;
    }

    private string? UserId => User.FindFirstValue(ClaimTypes.NameIdentifier);

    // GET /api/posts?page=1
    [HttpGet]
    public async Task<IActionResult> GetFeed([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var skip = (page - 1) * pageSize;
        var posts = await _context.Posts
            .Include(p => p.User)
            .Include(p => p.Images)
            .Include(p => p.Likes)
            .Include(p => p.Comments)
            .OrderByDescending(p => p.CreatedAt)
            .Skip(skip)
            .Take(pageSize)
            .ToListAsync();

        var total = await _context.Posts.CountAsync();
        return Ok(new
        {
            total,
            page,
            pageSize,
            items = posts.Select(p => MapDto(p, UserId))
        });
    }

    // GET /api/posts/{id}
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var post = await _context.Posts
            .Include(p => p.User)
            .Include(p => p.Images)
            .Include(p => p.Likes)
            .Include(p => p.Comments).ThenInclude(c => c.User)
            .FirstOrDefaultAsync(p => p.Id == id);
        if (post == null) return NotFound();
        return Ok(MapDto(post, UserId));
    }

    // POST /api/posts
    [HttpPost]
    [Authorize]
    public async Task<IActionResult> Create([FromBody] CreatePostRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Content)) return BadRequest("Indhold er påkrævet");
        var post = new Post { UserId = UserId!, Content = req.Content };
        _context.Posts.Add(post);
        await _context.SaveChangesAsync();

        var created = await _context.Posts
            .Include(p => p.User)
            .Include(p => p.Images)
            .Include(p => p.Likes)
            .Include(p => p.Comments)
            .FirstAsync(p => p.Id == post.Id);
        return CreatedAtAction(nameof(GetById), new { id = post.Id }, MapDto(created, UserId));
    }

    // DELETE /api/posts/{id}
    [HttpDelete("{id:int}")]
    [Authorize]
    public async Task<IActionResult> Delete(int id)
    {
        var post = await _context.Posts.Include(p => p.Images).FirstOrDefaultAsync(p => p.Id == id);
        if (post == null) return NotFound();
        if (post.UserId != UserId && !User.IsInRole("Admin")) return Forbid();

        foreach (var img in post.Images)
            DeleteImageFile(img.FileName);

        _context.Posts.Remove(post);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    // POST /api/posts/{id}/images
    [HttpPost("{id:int}/images")]
    [Authorize]
    public async Task<IActionResult> UploadImage(int id, IFormFile file)
    {
        var post = await _context.Posts.Include(p => p.Images).FirstOrDefaultAsync(p => p.Id == id);
        if (post == null) return NotFound();
        if (post.UserId != UserId) return Forbid();
        if (post.Images.Count >= 4) return BadRequest("Maks 4 billeder per opslag");

        var allowed = new[] { "image/jpeg", "image/png", "image/webp" };
        if (!allowed.Contains(file.ContentType.ToLowerInvariant()))
            return BadRequest("Kun JPG, PNG og WEBP er tilladt");

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var fileName = $"{Guid.NewGuid()}{ext}";
        var uploadPath = Path.Combine(GetUploadsDir(), fileName);

        await using var stream = System.IO.File.Create(uploadPath);
        await file.CopyToAsync(stream);

        var image = new PostImage { PostId = id, FileName = fileName, Order = post.Images.Count };
        _context.PostImages.Add(image);
        await _context.SaveChangesAsync();

        return Ok(new { id = image.Id, url = $"/uploads/posts/{fileName}" });
    }

    // POST /api/posts/{id}/like
    [HttpPost("{id:int}/like")]
    [Authorize]
    public async Task<IActionResult> ToggleLike(int id)
    {
        var post = await _context.Posts.FindAsync(id);
        if (post == null) return NotFound();

        var existing = await _context.PostLikes.FindAsync(id, UserId);
        if (existing != null)
        {
            _context.PostLikes.Remove(existing);
            await _context.SaveChangesAsync();
            return Ok(new { liked = false });
        }
        else
        {
            _context.PostLikes.Add(new PostLike { PostId = id, UserId = UserId! });
            await _context.SaveChangesAsync();
            return Ok(new { liked = true });
        }
    }

    // GET /api/posts/{id}/comments
    [HttpGet("{id:int}/comments")]
    public async Task<IActionResult> GetComments(int id)
    {
        var comments = await _context.PostComments
            .Include(c => c.User)
            .Where(c => c.PostId == id)
            .OrderBy(c => c.CreatedAt)
            .ToListAsync();
        return Ok(comments.Select(MapCommentDto));
    }

    // POST /api/posts/{id}/comments
    [HttpPost("{id:int}/comments")]
    [Authorize]
    public async Task<IActionResult> AddComment(int id, [FromBody] AddCommentRequest req)
    {
        var post = await _context.Posts.FindAsync(id);
        if (post == null) return NotFound();
        if (string.IsNullOrWhiteSpace(req.Content)) return BadRequest("Kommentar må ikke være tom");

        var comment = new PostComment { PostId = id, UserId = UserId!, Content = req.Content };
        _context.PostComments.Add(comment);
        await _context.SaveChangesAsync();

        var created = await _context.PostComments.Include(c => c.User).FirstAsync(c => c.Id == comment.Id);
        return Ok(MapCommentDto(created));
    }

    // DELETE /api/posts/{id}/comments/{commentId}
    [HttpDelete("{id:int}/comments/{commentId:int}")]
    [Authorize]
    public async Task<IActionResult> DeleteComment(int id, int commentId)
    {
        var comment = await _context.PostComments.FirstOrDefaultAsync(c => c.Id == commentId && c.PostId == id);
        if (comment == null) return NotFound();
        if (comment.UserId != UserId && !User.IsInRole("Admin")) return Forbid();

        _context.PostComments.Remove(comment);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    private string GetUploadsDir()
    {
        var path = Path.Combine(_env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"), "uploads", "posts");
        Directory.CreateDirectory(path);
        return path;
    }

    private void DeleteImageFile(string fileName)
    {
        var path = Path.Combine(GetUploadsDir(), fileName);
        if (System.IO.File.Exists(path)) System.IO.File.Delete(path);
    }

    private static object MapDto(Post p, string? currentUserId) => new
    {
        p.Id,
        p.UserId,
        AuthorCallsign = p.User?.Callsign ?? p.User?.Email,
        AuthorName = p.User != null ? $"{p.User.FirstName} {p.User.LastName}".Trim() : null,
        p.Content,
        Images = p.Images.OrderBy(i => i.Order).Select(i => $"/uploads/posts/{i.FileName}"),
        LikeCount = p.Likes.Count,
        IsLikedByMe = currentUserId != null && p.Likes.Any(l => l.UserId == currentUserId),
        CommentCount = p.Comments.Count,
        p.CreatedAt,
        p.UpdatedAt,
    };

    private static object MapCommentDto(PostComment c) => new
    {
        c.Id,
        c.PostId,
        c.UserId,
        AuthorCallsign = c.User?.Callsign ?? c.User?.Email,
        c.Content,
        c.CreatedAt,
    };
}

public record CreatePostRequest(string Content);
public record AddCommentRequest(string Content);
