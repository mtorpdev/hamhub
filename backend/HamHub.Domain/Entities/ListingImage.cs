namespace HamHub.Domain.Entities;

public class ListingImage
{
    public int Id { get; set; }
    public int ListingId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public int Order { get; set; } = 0;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Listing Listing { get; set; } = null!;
}
