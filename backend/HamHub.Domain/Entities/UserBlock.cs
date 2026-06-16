namespace HamHub.Domain.Entities;

public class UserBlock
{
    public int Id { get; set; }
    public string BlockerId { get; set; } = string.Empty;
    public string BlockedId { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ApplicationUser Blocker { get; set; } = null!;
    public ApplicationUser Blocked { get; set; } = null!;
}
