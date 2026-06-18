using HamHub.Domain.Enums;

namespace HamHub.Api.Services.Awards;

public record AwardQuery(
    string? Callsign = null,
    Band? Band = null,
    Mode? Mode = null,
    string? Sponsor = null,
    string? Status = null);

public record AwardCatalogItemDto(
    string Id,
    string Sponsor,
    string Name,
    string Description,
    string Status,
    string RuleType,
    int? NextThreshold,
    string[] DataRequirements);

public record AwardEntityProgressDto(
    string Key,
    string Label,
    string Status,
    int? QsoId,
    string[] ConfirmationSources);

public record AwardProgressDto(
    string Id,
    string Sponsor,
    string Name,
    string Description,
    string Status,
    string RuleType,
    int WorkedCount,
    int ConfirmedCount,
    int MissingCount,
    int? NextThreshold,
    string[] DataRequirements,
    string[] Warnings,
    AwardEntityProgressDto[] Entities,
    AwardEntityProgressDto[] MissingEntities,
    AwardEntityProgressDto[] UnconfirmedEntities);

public record AwardSummaryResponse(int QsoCount, int ConfirmedQsoCount, AwardProgressDto[] Awards, AwardDataQualityResponse DataQuality);

public record AwardDataQualityResponse(
    int IssueQsoCount,
    AwardDataQualityIssueDto[] Issues,
    AwardDataQualityQsoDto[] Qsos);

public record AwardDataQualityIssueDto(
    string Field,
    string Label,
    string Severity,
    int QsoCount,
    string[] AwardIds);

public record AwardDataQualityQsoDto(
    int QsoId,
    DateTime DateUtc,
    string WorkedCallsign,
    string Band,
    string Mode,
    AwardMissingFieldDto[] MissingFields);

public record AwardMissingFieldDto(
    string Field,
    string Label,
    string Severity,
    string[] AwardIds);

public record AwardDetailResponse(AwardProgressDto Award);

public record AwardDefinition(
    string Id,
    string Sponsor,
    string Name,
    string Description,
    string Status,
    string RuleType,
    int[] Thresholds,
    string[] DataRequirements,
    string[]? EntityUniverse = null);
