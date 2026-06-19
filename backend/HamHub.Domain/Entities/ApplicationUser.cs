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
    public int? DefaultStationId { get; set; }
    public string? PreferredLanguage { get; set; }
    public LicenseClass? LicenseClass { get; set; }
    public string? ProfileDescription { get; set; }
    public string? ProfileImageUrl { get; set; }
    public ProfileVisibility Visibility { get; set; } = ProfileVisibility.Public;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public string? QrzApiKey { get; set; }
    public DateTime? QrzLastSyncedAt { get; set; }

    public string? QrzUsername { get; set; }
    public string? QrzXmlPassword { get; set; }

    public string? EqslUsername { get; set; }
    public string? EqslPassword { get; set; }
    public string? EqslQthNickname { get; set; }
    public DateTime? EqslLastSyncedAt { get; set; }

    public string? LotwUsername { get; set; }
    public string? LotwPassword { get; set; }
    public DateTime? LotwLastSyncedAt { get; set; }

    public ICollection<StationProfile> Stations { get; set; } = new List<StationProfile>();
    public ICollection<QsoEntry> QsoEntries { get; set; } = new List<QsoEntry>();
    public ICollection<DxSpot> DxSpots { get; set; } = new List<DxSpot>();
    public ICollection<Article> Articles { get; set; } = new List<Article>();
    public ICollection<ChatMessage> ChatMessages { get; set; } = new List<ChatMessage>();
    public ICollection<Friendship> SentFriendRequests { get; set; } = new List<Friendship>();
    public ICollection<Friendship> ReceivedFriendRequests { get; set; } = new List<Friendship>();
}
