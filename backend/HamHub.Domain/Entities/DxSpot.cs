using HamHub.Domain.Enums;

namespace HamHub.Domain.Entities;

public class DxSpot
{
    public int Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string Callsign { get; set; } = string.Empty;
    public double Frequency { get; set; }
    public Band Band { get; set; }
    public Mode Mode { get; set; }
    public string? Comment { get; set; }
    public DateTime SpottedAt { get; set; } = DateTime.UtcNow;

    public ApplicationUser User { get; set; } = null!;
}
