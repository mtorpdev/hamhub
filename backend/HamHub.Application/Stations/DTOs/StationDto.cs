using HamHub.Domain.Enums;

namespace HamHub.Application.Stations.DTOs;

public record StationDto(
    int Id,
    string UserId,
    string Name,
    string? Callsign,
    string? RadioEquipment,
    string? AntennaDescription,
    int? PowerOutput,
    string? Location,
    string? GridLocator,
    List<Mode> SupportedModes,
    List<Band> SupportedBands,
    DateTime CreatedAt
);
