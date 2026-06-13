namespace HamHub.Application.Articles.DTOs;

public record ArticleDto(
    int Id,
    string Title,
    string Slug,
    string? Summary,
    string Content,
    int CategoryId,
    string CategoryName,
    string AuthorId,
    string? AuthorCallsign,
    bool IsPublished,
    DateTime? PublishDate,
    DateTime CreatedAt
);
