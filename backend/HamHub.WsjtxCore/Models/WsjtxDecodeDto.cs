namespace HamHub.WsjtxCore.Models;

public record WsjtxDecodeDto(
    string WsjtxId,
    uint WsjtxTimeMs,
    string SpotterCallsign,
    string? SpotterGrid,
    string Message,
    string? DxCallsign,
    string? DxGrid,
    int Snr,
    double DeltaTime,
    int DeltaFreqHz,
    double FrequencyMhz,
    string Mode,
    bool LowConfidence,
    DateTime DecodedAt
);
