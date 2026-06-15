using HamHub.Domain.Enums;
using System.ComponentModel.DataAnnotations;

namespace HamHub.Application.QsoEntries.DTOs;

public record CreateQsoDto(
    [Required] DateTime DateUtc,
    [Required] string OwnCallsign,
    [Required] string WorkedCallsign,
    [Required] Band Band,
    double? Frequency,
    [Required] Mode Mode,
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
    string? Comment
);
