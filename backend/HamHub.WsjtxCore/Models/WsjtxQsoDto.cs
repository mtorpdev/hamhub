namespace HamHub.WsjtxCore.Models;

public record WsjtxQsoDto(
    DateTime DateUtc,
    string OwnCallsign,
    string WorkedCallsign,
    double FrequencyMhz,
    string Mode,
    string? RstSent,
    string? RstReceived,
    string? Locator,
    string? Notes
);
