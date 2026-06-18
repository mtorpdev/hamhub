namespace HamHub.Domain.Entities;

public class CommunityGroupInvitation
{
    public int Id { get; set; }
    public int CommunityRoomId { get; set; }
    public string InviterId { get; set; } = string.Empty;
    public string InviteeId { get; set; } = string.Empty;
    public CommunityGroupRequestStatus Status { get; set; } = CommunityGroupRequestStatus.Pending;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ResolvedAt { get; set; }

    public CommunityRoom CommunityRoom { get; set; } = null!;
    public ApplicationUser Inviter { get; set; } = null!;
    public ApplicationUser Invitee { get; set; } = null!;
}
