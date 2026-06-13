namespace HamHub.WsjtxCore.Models;

public record WsjtxDecodeDto(
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
