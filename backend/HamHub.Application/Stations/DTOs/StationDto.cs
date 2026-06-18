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
    StationType StationType,
    string? Description,
    ProfileVisibility Visibility,
    List<Mode> SupportedModes,
    List<Band> SupportedBands,
    DateTime CreatedAt,
    IReadOnlyList<StationImageDto> Images
);

public record StationImageDto(int Id, string Url);
