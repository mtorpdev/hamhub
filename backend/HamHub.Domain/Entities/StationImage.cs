namespace HamHub.Domain.Entities;

public class StationImage
{
    public int Id { get; set; }
    public int StationProfileId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public int Order { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public StationProfile StationProfile { get; set; } = null!;
}
