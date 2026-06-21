namespace HamHub.Domain.Entities;

public class QsoAnalysis
{
    public int Id { get; set; }
    public int QsoId { get; set; }
    public string UserId { get; set; } = string.Empty;
    public DateTime GeneratedAtUtc { get; set; } = DateTime.UtcNow;
    public int AnalysisVersion { get; set; }
    public string InputHash { get; set; } = string.Empty;
    public int OverallScore { get; set; }
    public int ConfirmationScore { get; set; }
    public int DataQualityScore { get; set; }
    public int AwardImpactScore { get; set; }
    public int PropagationScore { get; set; }
    public int DuplicateRiskScore { get; set; }
    public string FlagsJson { get; set; } = "[]";
    public string HighlightsJson { get; set; } = "[]";
    public string MissingDataJson { get; set; } = "[]";
    public string AwardImpactJson { get; set; } = "{}";
    public string QslJson { get; set; } = "{}";
    public string PropagationJson { get; set; } = "{}";
    public string SunJson { get; set; } = "{}";
    public string WeatherJson { get; set; } = "{}";
    public string DuplicateRiskJson { get; set; } = "{}";
    public string StoryText { get; set; } = string.Empty;

    public QsoEntry Qso { get; set; } = null!;
    public ApplicationUser User { get; set; } = null!;
}
