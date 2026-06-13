using System.ComponentModel.DataAnnotations;

namespace HamHub.Application.Auth.DTOs;

public record RegisterDto(
    [Required, EmailAddress] string Email,
    [Required, MinLength(6)] string Password,
    string? Callsign,
    string? FirstName,
    string? LastName
);
