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
    string? Locator,
    string? Country,
    string? Notes
);
