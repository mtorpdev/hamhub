namespace HamHub.Domain.Entities;

public class PostLike
{
    public int PostId { get; set; }
    public string UserId { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Post Post { get; set; } = null!;
    public ApplicationUser User { get; set; } = null!;
}
