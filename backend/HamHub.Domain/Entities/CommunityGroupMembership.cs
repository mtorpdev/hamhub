namespace HamHub.Domain.Entities;

public class CommunityGroupMembership
{
    public int Id { get; set; }
    public int CommunityRoomId { get; set; }
    public string UserId { get; set; } = string.Empty;
    public CommunityGroupRole Role { get; set; } = CommunityGroupRole.Member;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public CommunityRoom CommunityRoom { get; set; } = null!;
    public ApplicationUser User { get; set; } = null!;
}
