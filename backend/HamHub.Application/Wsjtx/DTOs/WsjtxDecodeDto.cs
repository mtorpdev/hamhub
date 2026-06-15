namespace HamHub.Application.Wsjtx.DTOs;

public record WsjtxDecodeDto(
    int Id,
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
    bool IsCallable,
    DateTime DecodedAt
);

// Inbound from plugin
public record PostDecodeDto(
    string? WsjtxId,
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
