namespace HamHub.Domain.Entities;

public class CommunityRoom
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
    public bool IsSystem { get; set; } = true;
    public string? OwnerId { get; set; }
    public CommunityGroupVisibility Visibility { get; set; } = CommunityGroupVisibility.Public;
    public bool AllowJoinRequests { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ApplicationUser? Owner { get; set; }
    public ICollection<Post> Posts { get; set; } = new List<Post>();
    public ICollection<ChatMessage> ChatMessages { get; set; } = new List<ChatMessage>();
    public ICollection<CommunityGroupMembership> Memberships { get; set; } = new List<CommunityGroupMembership>();
    public ICollection<CommunityGroupJoinRequest> JoinRequests { get; set; } = new List<CommunityGroupJoinRequest>();
    public ICollection<CommunityGroupInvitation> Invitations { get; set; } = new List<CommunityGroupInvitation>();
}
