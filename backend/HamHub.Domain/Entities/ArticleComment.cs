namespace HamHub.Domain.Entities;

public class ArticleComment
{
    public int Id { get; set; }
    public int ArticleId { get; set; }
    public string AuthorId { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Article Article { get; set; } = null!;
    public ApplicationUser Author { get; set; } = null!;
}
