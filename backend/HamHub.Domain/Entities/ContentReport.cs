using HamHub.Domain.Enums;

namespace HamHub.Domain.Entities;

public class ContentReport
{
    public int Id { get; set; }
    public string ReporterId { get; set; } = string.Empty;
    public string TargetType { get; set; } = string.Empty;
    public string? TargetUserId { get; set; }
    public int? TargetId { get; set; }
    public string Reason { get; set; } = string.Empty;
    public ReportStatus Status { get; set; } = ReportStatus.Open;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ResolvedAt { get; set; }

    public ApplicationUser Reporter { get; set; } = null!;
    public ApplicationUser? TargetUser { get; set; }
}
