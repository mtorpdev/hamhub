namespace HamHub.Application.Wsjtx.DTOs;

public record WsjtxDecodeDto(
    int Id,
    string SpotterCallsign,
    string Message,
    string? DxCallsign,
    string? DxGrid,
    int Snr,
    double DeltaTime,
    uint DeltaFreqHz,
    double FrequencyMhz,
    string Mode,
    DateTime DecodedAt
)
{
    public WsjtxDecodeDto() : this(0, string.Empty, string.Empty, null, null, 0, 0, 0, 0, string.Empty, default) { }
}

// Inbound from plugin
public record PostDecodeDto(
    string SpotterCallsign,
    string Message,
    string? DxCallsign,
    string? DxGrid,
    int Snr,
    double DeltaTime,
    uint DeltaFreqHz,
    double FrequencyMhz,
    string Mode,
    DateTime DecodedAt
);
