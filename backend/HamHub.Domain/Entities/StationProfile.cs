using HamHub.Domain.Enums;

namespace HamHub.Domain.Entities;

public class StationProfile
{
    public int Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Callsign { get; set; }
    public string? RadioEquipment { get; set; }
    public string? AntennaDescription { get; set; }
    public int? PowerOutput { get; set; }
    public string? Location { get; set; }
    public string? GridLocator { get; set; }
    public StationType StationType { get; set; } = StationType.HomeShack;
    public string? Description { get; set; }
    public ProfileVisibility Visibility { get; set; } = ProfileVisibility.Private;
    public List<Mode> SupportedModes { get; set; } = new();
    public List<Band> SupportedBands { get; set; } = new();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ApplicationUser User { get; set; } = null!;
    public ICollection<StationImage> Images { get; set; } = new List<StationImage>();
}
