using AutoMapper;
using HamHub.Application.Articles.DTOs;
using HamHub.Domain.Entities;
using HamHub.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace HamHub.Api.Controllers;

[ApiController]
[Route("api/articles")]
public class ArticlesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IMapper _mapper;

    public ArticlesController(ApplicationDbContext context, IMapper mapper)
    {
        _context = context;
        _mapper = mapper;
    }

    [HttpGet]
    public async Task<IActionResult> GetPublished()
    {
        var articles = await _context.Articles
            .Include(a => a.Category)
            .Include(a => a.Author)
            .Where(a => a.IsPublished)
            .OrderByDescending(a => a.PublishDate)
            .ToListAsync();
        return Ok(articles.Select(a => _mapper.Map<ArticleDto>(a)));
    }

    [HttpGet("all")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAll()
    {
        var articles = await _context.Articles
            .Include(a => a.Category)
            .Include(a => a.Author)
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync();
        return Ok(articles.Select(a => _mapper.Map<ArticleDto>(a)));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var article = await _context.Articles
            .Include(a => a.Category)
            .Include(a => a.Author)
            .FirstOrDefaultAsync(a => a.Id == id);
        if (article == null) return NotFound();
        if (!article.IsPublished && !User.IsInRole("Admin")) return NotFound();
        return Ok(_mapper.Map<ArticleDto>(article));
    }

    [HttpGet("{slug}")]
    public async Task<IActionResult> GetBySlug(string slug)
    {
        var article = await _context.Articles
            .Include(a => a.Category)
            .Include(a => a.Author)
            .FirstOrDefaultAsync(a => a.Slug == slug);
        if (article == null) return NotFound();
        if (!article.IsPublished && !User.IsInRole("Admin")) return NotFound();
        return Ok(_mapper.Map<ArticleDto>(article));
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create([FromBody] CreateArticleDto dto)
    {
        var authorId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var article = _mapper.Map<Article>(dto);
        article.AuthorId = authorId;
        _context.Articles.Add(article);
        await _context.SaveChangesAsync();

        var created = await _context.Articles.Include(a => a.Category).Include(a => a.Author).FirstAsync(a => a.Id == article.Id);
        return CreatedAtAction(nameof(GetById), new { id = article.Id }, _mapper.Map<ArticleDto>(created));
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update(int id, [FromBody] CreateArticleDto dto)
    {
        var article = await _context.Articles.FindAsync(id);
        if (article == null) return NotFound();

        article.Title = dto.Title;
        article.Slug = dto.Slug;
        article.Summary = dto.Summary;
        article.Content = dto.Content;
        article.CategoryId = dto.CategoryId;
        article.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        var updated = await _context.Articles.Include(a => a.Category).Include(a => a.Author).FirstAsync(a => a.Id == id);
        return Ok(_mapper.Map<ArticleDto>(updated));
    }

    [HttpPost("{id}/publish")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Publish(int id)
    {
        var article = await _context.Articles.FindAsync(id);
        if (article == null) return NotFound();
        article.IsPublished = true;
        article.PublishDate = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return Ok();
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        var article = await _context.Articles.FindAsync(id);
        if (article == null) return NotFound();
        _context.Articles.Remove(article);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}
