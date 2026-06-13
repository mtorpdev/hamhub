namespace HamHub.Application.Auth.DTOs;

public record AuthResponseDto(
    string Token,
    string UserId,
    string Email,
    string? Callsign,
    IList<string> Roles
);
