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
)
{
    public DxSpotDto() : this(0, string.Empty, string.Empty, string.Empty, 0, default, default, null, default) { }
}
