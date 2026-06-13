namespace HamHub.Application.Wsjtx.DTOs;

public record WsjtxDecodeDto(
    int Id,
    string SpotterCallsign,
    string Message,
    string? DxCallsign,
    string? DxGrid,
    int Snr,
    double DeltaTime,
    int DeltaFreqHz,
    double FrequencyMhz,
    string Mode,
    DateTime DecodedAt
);

// Inbound from plugin
public record PostDecodeDto(
    string SpotterCallsign,
    string Message,
    string? DxCallsign,
    string? DxGrid,
    int Snr,
    double DeltaTime,
    int DeltaFreqHz,
    double FrequencyMhz,
    string Mode,
    DateTime DecodedAt
);
