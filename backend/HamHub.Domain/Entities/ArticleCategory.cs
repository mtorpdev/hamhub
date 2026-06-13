namespace HamHub.Domain.Entities;

public class ArticleCategory
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;

    public ICollection<Article> Articles { get; set; } = new List<Article>();
}
