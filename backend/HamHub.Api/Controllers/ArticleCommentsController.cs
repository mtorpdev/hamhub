using HamHub.Application.Articles.DTOs;
using HamHub.Domain.Entities;
using HamHub.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace HamHub.Api.Controllers;

[ApiController]
[Route("api/articles/{articleId}/comments")]
public class ArticleCommentsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public ArticleCommentsController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetComments(int articleId)
    {
        var comments = await _context.ArticleComments
            .Include(c => c.Author)
            .Where(c => c.ArticleId == articleId)
            .OrderBy(c => c.CreatedAt)
            .ToListAsync();

        return Ok(comments.Select(c => new ArticleCommentDto(
            c.Id, c.ArticleId, c.AuthorId, c.Author.Callsign, c.Content, c.CreatedAt
        )));
    }

    [HttpPost]
    [Authorize]
    public async Task<IActionResult> Create(int articleId, [FromBody] CreateCommentDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Content))
            return BadRequest("Content is required");

        var article = await _context.Articles.FindAsync(articleId);
        if (article == null || !article.IsPublished) return NotFound();

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var comment = new ArticleComment
        {
            ArticleId = articleId,
            AuthorId = userId,
            Content = dto.Content.Trim(),
        };
        _context.ArticleComments.Add(comment);
        await _context.SaveChangesAsync();

        await _context.Entry(comment).Reference(c => c.Author).LoadAsync();
        return Ok(new ArticleCommentDto(
            comment.Id, comment.ArticleId, comment.AuthorId, comment.Author.Callsign, comment.Content, comment.CreatedAt
        ));
    }

    [HttpDelete("{commentId}")]
    [Authorize]
    public async Task<IActionResult> Delete(int articleId, int commentId)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var comment = await _context.ArticleComments.FindAsync(commentId);
        if (comment == null || comment.ArticleId != articleId) return NotFound();
        if (comment.AuthorId != userId && !User.IsInRole("Admin")) return Forbid();

        _context.ArticleComments.Remove(comment);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}
