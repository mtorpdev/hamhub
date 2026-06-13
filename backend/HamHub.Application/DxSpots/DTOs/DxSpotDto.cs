using HamHub.Domain.Enums;

namespace HamHub.Application.DxSpots.DTOs;

public record DxSpotDto(
    int Id,
    string UserId,
    string SpotterCallsign,
    string Callsign,
    double Frequency,
    Band Band,
    Mode Mode,
    string? Comment,
    DateTime SpottedAt
);
