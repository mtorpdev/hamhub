namespace HamHub.Domain.Entities;

public class CommunityGroupJoinRequest
{
    public int Id { get; set; }
    public int CommunityRoomId { get; set; }
    public string UserId { get; set; } = string.Empty;
    public CommunityGroupRequestStatus Status { get; set; } = CommunityGroupRequestStatus.Pending;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ResolvedAt { get; set; }

    public CommunityRoom CommunityRoom { get; set; } = null!;
    public ApplicationUser User { get; set; } = null!;
}
