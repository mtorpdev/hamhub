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
)
{
    public ArticleDto() : this(0, string.Empty, string.Empty, null, string.Empty, 0, string.Empty, string.Empty, null, false, null, default) { }
}
