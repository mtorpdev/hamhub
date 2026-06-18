namespace HamHub.Domain.Entities;

public class Post
{
    public int Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public int? CommunityRoomId { get; set; }
    public string? Title { get; set; }
    public string? Tags { get; set; }
    public bool IsSolved { get; set; }
    public string Content { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ApplicationUser User { get; set; } = null!;
    public CommunityRoom? CommunityRoom { get; set; }
    public ICollection<PostImage> Images { get; set; } = new List<PostImage>();
    public ICollection<PostLike> Likes { get; set; } = new List<PostLike>();
    public ICollection<PostComment> Comments { get; set; } = new List<PostComment>();
}
