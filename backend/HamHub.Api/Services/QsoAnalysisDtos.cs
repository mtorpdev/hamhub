namespace HamHub.Api.Services;

public record QsoAnalysisResponse(
    int Id,
    int QsoId,
    DateTime GeneratedAtUtc,
    int AnalysisVersion,
    QsoAnalysisScoresDto Scores,
    string[] Highlights,
    QsoAnalysisFlagDto[] Flags,
    QsoAnalysisQslDto[] Qsl,
    QsoAnalysisAwardImpactDto AwardImpact,
    QsoAnalysisPropagationDto Propagation,
    QsoAnalysisSunDto Sun,
    QsoAnalysisWeatherDto Weather,
    QsoAnalysisDataIssueDto[] DataQuality,
    QsoAnalysisDuplicateRiskDto DuplicateRisk,
    string StoryText);

public record QsoAnalysisScoresDto(int Overall, int Confirmation, int DataQuality, int AwardImpact, int Propagation, int DuplicateRisk);
public record QsoAnalysisFlagDto(string Key, string Label, string Severity, string Description);
public record QsoAnalysisQslDto(string Provider, string Status, string Label, string Description, DateTime? ConfirmedAt, DateTime? LastUpdatedAt);
public record QsoAnalysisAwardImpactDto(string[] ContributesTo, string[] BlockedByMissingFields, string[] ConfirmationSources);
public record QsoAnalysisPropagationDto(double? DistanceKm, double? BearingDegrees, string PathLight, string[] BandFacts);
public record QsoAnalysisSunDto(double? OwnElevationDegrees, double? WorkedElevationDegrees, double? MidpointElevationDegrees, string Classification);
public record QsoAnalysisWeatherDto(QsoWeatherDto? Own, QsoWeatherDto? Worked, string Source);
public record QsoAnalysisDataIssueDto(string Field, string Label, string Severity, string Description);
public record QsoAnalysisDuplicateRiskDto(int Score, int CandidateCount, int? ClosestQsoId, double? DeltaSeconds, bool LocalTimeOffsetRisk);
