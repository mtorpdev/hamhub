using System.ComponentModel.DataAnnotations;

namespace HamHub.Application.Articles.DTOs;

public record CreateArticleDto(
    [Required] string Title,
    [Required] string Slug,
    string? Summary,
    [Required] string Content,
    [Required] int CategoryId
);
