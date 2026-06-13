namespace HamHub.Domain.Entities;

public class WsjtxDecode
{
    public int Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string SpotterCallsign { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string? DxCallsign { get; set; }
    public string? DxGrid { get; set; }
    public int Snr { get; set; }
    public double DeltaTime { get; set; }
    public int DeltaFreqHz { get; set; }
    public double FrequencyMhz { get; set; }
    public string Mode { get; set; } = string.Empty;
    public DateTime DecodedAt { get; set; } = DateTime.UtcNow;

    public ApplicationUser User { get; set; } = null!;
}
