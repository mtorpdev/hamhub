using HamHub.Domain.Enums;

namespace HamHub.Domain.Entities;

public class Listing
{
    public int Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public string Currency { get; set; } = "DKK";
    public ListingCategory Category { get; set; }
    public ListingCondition Condition { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsSold { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ApplicationUser User { get; set; } = null!;
    public ICollection<ListingImage> Images { get; set; } = new List<ListingImage>();
}
