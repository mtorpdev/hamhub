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
    string? Submode,
    string? Locator,
    string? MyGridsquare,
    string? Country,
    int? Dxcc,
    string? Continent,
    string? State,
    string? Iota,
    string? Name,
    string? Qth,
    double? TxPower,
    string? Comment,
    string? QrzId,
    DateTime? EqslSentAt,
    DateTime? EqslConfirmedAt,
    string? EqslLastResult,
    DateTime CreatedAt,
    DateTime UpdatedAt
);
