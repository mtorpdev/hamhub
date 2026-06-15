namespace HamHub.Domain.Entities;

public class PostImage
{
    public int Id { get; set; }
    public int PostId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public int Order { get; set; } = 0;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Post Post { get; set; } = null!;
}
