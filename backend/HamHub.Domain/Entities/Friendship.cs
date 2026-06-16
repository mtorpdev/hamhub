using HamHub.Domain.Enums;

namespace HamHub.Domain.Entities;

public class Friendship
{
    public int Id { get; set; }
    public string RequesterId { get; set; } = string.Empty;
    public string AddresseeId { get; set; } = string.Empty;
    public FriendshipStatus Status { get; set; } = FriendshipStatus.Pending;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? RespondedAt { get; set; }

    public ApplicationUser Requester { get; set; } = null!;
    public ApplicationUser Addressee { get; set; } = null!;
}
