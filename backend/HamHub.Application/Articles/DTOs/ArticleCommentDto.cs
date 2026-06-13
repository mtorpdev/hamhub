namespace HamHub.Application.Articles.DTOs;

public record ArticleCommentDto(
    int Id,
    int ArticleId,
    string AuthorId,
    string? AuthorCallsign,
    string Content,
    DateTime CreatedAt
)
{
    public ArticleCommentDto() : this(0, 0, string.Empty, null, string.Empty, default) { }
}

public record CreateCommentDto(string Content);
