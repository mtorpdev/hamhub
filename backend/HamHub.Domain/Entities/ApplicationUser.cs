using HamHub.Domain.Enums;
using Microsoft.AspNetCore.Identity;

namespace HamHub.Domain.Entities;

public class ApplicationUser : IdentityUser
{
    public string? Callsign { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Country { get; set; }
    public string? GridLocator { get; set; }
    public LicenseClass? LicenseClass { get; set; }
    public string? ProfileDescription { get; set; }
    public string? ProfileImageUrl { get; set; }
    public ProfileVisibility Visibility { get; set; } = ProfileVisibility.Public;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public string? QrzApiKey { get; set; }
    public DateTime? QrzLastSyncedAt { get; set; }

    public ICollection<StationProfile> Stations { get; set; } = new List<StationProfile>();
    public ICollection<QsoEntry> QsoEntries { get; set; } = new List<QsoEntry>();
    public ICollection<DxSpot> DxSpots { get; set; } = new List<DxSpot>();
    public ICollection<Article> Articles { get; set; } = new List<Article>();
}
