using HamHub.Domain.Enums;

namespace HamHub.Application.Users.DTOs;

public record UpdateUserDto(
    string? Callsign,
    string? FirstName,
    string? LastName,
    string? Country,
    string? GridLocator,
    int? DefaultStationId,
    string? PreferredLanguage,
    LicenseClass? LicenseClass,
    string? ProfileDescription,
    string? ProfileImageUrl,
    ProfileVisibility Visibility
);
