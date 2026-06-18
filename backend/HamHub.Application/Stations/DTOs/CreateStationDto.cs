using HamHub.Domain.Enums;
using System.ComponentModel.DataAnnotations;

namespace HamHub.Application.Stations.DTOs;

public record CreateStationDto(
    [Required] string Name,
    string? Callsign,
    string? RadioEquipment,
    string? AntennaDescription,
    int? PowerOutput,
    string? Location,
    string? GridLocator,
    List<Mode>? SupportedModes,
    List<Band>? SupportedBands,
    StationType StationType = StationType.HomeShack,
    string? Description = null,
    ProfileVisibility Visibility = ProfileVisibility.Private
);
