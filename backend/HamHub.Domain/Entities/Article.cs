namespace HamHub.Domain.Entities;

public class Article
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Summary { get; set; }
    public string Content { get; set; } = string.Empty;
    public string? SourceName { get; set; }
    public string? SourceUrl { get; set; }
    public string? OriginalUrl { get; set; }
    public string? FeedGuid { get; set; }
    public DateTime? ImportedAt { get; set; }
    public int CategoryId { get; set; }
    public string AuthorId { get; set; } = string.Empty;
    public bool IsPublished { get; set; } = false;
    public DateTime? PublishDate { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ArticleCategory Category { get; set; } = null!;
    public ApplicationUser Author { get; set; } = null!;
}
