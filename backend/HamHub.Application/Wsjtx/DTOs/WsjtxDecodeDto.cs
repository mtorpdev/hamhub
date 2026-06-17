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
    string? DxCountry,
    string? DxContinent,
    string? DxPrimaryPrefix,
    string? DxMatchedPrefix,
    string? DxWpxPrefix,
    int? DxCqZone,
    int? DxItuZone,
    double? DxLatitude,
    double? DxLongitude,
    double? DxUtcOffset,
    DateTime DecodedAt,
    DateTime ServerReceivedAtUtc
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
