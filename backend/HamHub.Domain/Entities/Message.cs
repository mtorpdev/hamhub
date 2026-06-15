namespace HamHub.Domain.Entities;

public class Message
{
    public int Id { get; set; }
    public string SenderId { get; set; } = string.Empty;
    public string RecipientId { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public bool IsRead { get; set; } = false;
    public bool SenderDeleted { get; set; } = false;
    public bool RecipientDeleted { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ApplicationUser Sender { get; set; } = null!;
    public ApplicationUser Recipient { get; set; } = null!;
}
