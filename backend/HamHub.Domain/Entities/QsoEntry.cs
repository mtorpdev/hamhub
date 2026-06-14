using HamHub.Domain.Enums;

namespace HamHub.Domain.Entities;

public class QsoEntry
{
    public int Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public DateTime DateUtc { get; set; }
    public string OwnCallsign { get; set; } = string.Empty;
    public string WorkedCallsign { get; set; } = string.Empty;
    public Band Band { get; set; }
    public double? Frequency { get; set; }
    public Mode Mode { get; set; }
    public string? RstSent { get; set; }
    public string? RstReceived { get; set; }
    public string? Locator { get; set; }
    public string? Country { get; set; }
    public string? Notes { get; set; }
    public string? QrzId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ApplicationUser User { get; set; } = null!;
}
