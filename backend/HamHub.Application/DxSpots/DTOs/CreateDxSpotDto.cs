using HamHub.Domain.Enums;
using System.ComponentModel.DataAnnotations;

namespace HamHub.Application.DxSpots.DTOs;

public record CreateDxSpotDto(
    [Required] string Callsign,
    [Required] double Frequency,
    [Required] Band Band,
    [Required] Mode Mode,
    string? Comment
);
