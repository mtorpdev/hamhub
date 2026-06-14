using HamHub.Domain.Enums;

namespace HamHub.Application.QsoEntries.DTOs;

public record QsoDto(
    int Id,
    string UserId,
    DateTime DateUtc,
    string OwnCallsign,
    string WorkedCallsign,
    Band Band,
    double? Frequency,
    Mode Mode,
    string? RstSent,
    string? RstReceived,
    string? Locator,
    string? Country,
    string? Notes,
    string? QrzId,
    DateTime CreatedAt,
    DateTime UpdatedAt
);
