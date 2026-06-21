using System.Text.Json;
using HamHub.Api.Services.Awards;
using HamHub.Domain.Entities;
using HamHub.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HamHub.Api.Services;

public class QsoAnalysisService
{
    public const int AnalysisVersion = 1;

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly ApplicationDbContext _context;
    private readonly AwardEngine _awardEngine;

    public QsoAnalysisService(ApplicationDbContext context, AwardEngine awardEngine)
    {
        _context = context;
        _awardEngine = awardEngine;
    }

    public async Task<QsoAnalysisResponse> GetOrCreateAsync(int qsoId, string userId, bool isAdmin, CancellationToken ct)
    {
        var qso = await _context.QsoEntries
            .Include(item => item.User)
            .Include(item => item.Analysis)
            .FirstOrDefaultAsync(item => item.Id == qsoId, ct);

        if (qso is null)
            throw new KeyNotFoundException($"QSO {qsoId} was not found.");

        if (!isAdmin && !string.Equals(qso.UserId, userId, StringComparison.Ordinal))
            throw new UnauthorizedAccessException("You do not have access to this QSO.");

        var duplicateCandidates = await LoadDuplicateCandidatesAsync(qso, ct);
        var duplicateRisk = BuildDuplicateRisk(qso, duplicateCandidates);
        var inputHash = QsoAnalysisInputHasher.Hash(qso, AnalysisVersion, BuildDuplicateCandidatesHash(duplicateCandidates));
        if (qso.Analysis is not null &&
            qso.Analysis.AnalysisVersion == AnalysisVersion &&
            string.Equals(qso.Analysis.InputHash, inputHash, StringComparison.Ordinal))
        {
            return ToResponse(qso.Analysis);
        }

        var generatedAtUtc = DateTime.UtcNow;
        var conditions = QsoConditionsBuilder.Build(qso);
        var qsl = BuildQsl(qso);
        var dataIssues = BuildDataIssues(qso);
        var propagation = BuildPropagation(conditions);
        var sun = BuildSun(conditions);
        var awardImpact = BuildAwardImpact(qso, qsl, dataIssues);
        var flags = BuildFlags(qsl, dataIssues, duplicateRisk);
        var scores = BuildScores(qsl, dataIssues, awardImpact, propagation, duplicateRisk);
        var highlights = BuildHighlights(qsl, awardImpact, propagation, duplicateRisk);
        var weather = new QsoAnalysisWeatherDto(conditions.OwnLocation?.Weather, conditions.WorkedLocation?.Weather, conditions.WeatherSource);
        var story = QsoAnalysisStoryBuilder.Build(qso, scores, awardImpact, propagation);

        var analysis = qso.Analysis ?? new QsoAnalysis
        {
            QsoId = qso.Id,
            UserId = qso.UserId
        };

        analysis.GeneratedAtUtc = generatedAtUtc;
        analysis.AnalysisVersion = AnalysisVersion;
        analysis.InputHash = inputHash;
        analysis.OverallScore = scores.Overall;
        analysis.ConfirmationScore = scores.Confirmation;
        analysis.DataQualityScore = scores.DataQuality;
        analysis.AwardImpactScore = scores.AwardImpact;
        analysis.PropagationScore = scores.Propagation;
        analysis.DuplicateRiskScore = scores.DuplicateRisk;
        analysis.FlagsJson = JsonSerializer.Serialize(flags, JsonOptions);
        analysis.HighlightsJson = JsonSerializer.Serialize(highlights, JsonOptions);
        analysis.MissingDataJson = JsonSerializer.Serialize(dataIssues, JsonOptions);
        analysis.AwardImpactJson = JsonSerializer.Serialize(awardImpact, JsonOptions);
        analysis.QslJson = JsonSerializer.Serialize(qsl, JsonOptions);
        analysis.PropagationJson = JsonSerializer.Serialize(propagation, JsonOptions);
        analysis.SunJson = JsonSerializer.Serialize(sun, JsonOptions);
        analysis.WeatherJson = JsonSerializer.Serialize(weather, JsonOptions);
        analysis.DuplicateRiskJson = JsonSerializer.Serialize(duplicateRisk, JsonOptions);
        analysis.StoryText = story;

        if (qso.Analysis is null)
        {
            _context.QsoAnalyses.Add(analysis);
            qso.Analysis = analysis;
        }

        var persistedAnalysis = await SaveAnalysisAsync(qso, analysis, ct);
        return ToResponse(persistedAnalysis);
    }

    private QsoAnalysisAwardImpactDto BuildAwardImpact(QsoEntry qso, QsoAnalysisQslDto[] qsl, QsoAnalysisDataIssueDto[] issues)
    {
        var summary = _awardEngine.Calculate(new[] { qso }, new AwardQuery());
        var contributesTo = summary.Awards
            .Where(award => string.Equals(award.Status, "active", StringComparison.OrdinalIgnoreCase) && award.WorkedCount > 0)
            .Select(award => award.Name)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Order(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        var blockedByMissingFields = issues
            .Where(issue => issue.Severity == "warning")
            .Select(issue => issue.Label)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Order(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        var confirmationSources = qsl
            .Where(item => string.Equals(item.Status, "confirmed", StringComparison.OrdinalIgnoreCase))
            .Select(item => item.Provider)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Order(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        return new QsoAnalysisAwardImpactDto(contributesTo, blockedByMissingFields, confirmationSources);
    }

    private static QsoAnalysisQslDto[] BuildQsl(QsoEntry qso)
    {
        return
        [
            BuildQsl(
                "LoTW",
                qso.LotwConfirmedAt.HasValue ? "confirmed" : !string.IsNullOrWhiteSpace(qso.LotwLastResult) ? "activity" : "none",
                "Logbook of The World",
                qso.LotwConfirmedAt.HasValue ? "Confirmed in LoTW." : string.IsNullOrWhiteSpace(qso.LotwLastResult) ? "No LoTW activity recorded." : qso.LotwLastResult!,
                qso.LotwConfirmedAt,
                qso.LotwQslDate),
            BuildQsl(
                "eQSL",
                qso.EqslConfirmedAt.HasValue ? "confirmed" : qso.EqslSentAt.HasValue ? "sent" : "none",
                "eQSL",
                qso.EqslConfirmedAt.HasValue ? "Confirmed in eQSL." : qso.EqslSentAt.HasValue ? "Uploaded to eQSL, waiting for confirmation." : "No eQSL activity recorded.",
                qso.EqslConfirmedAt,
                qso.EqslSentAt),
            BuildQsl(
                "QRZ",
                qso.QrzConfirmedAt.HasValue || string.Equals(qso.QrzConfirmationStatus, "C", StringComparison.OrdinalIgnoreCase) ? "confirmed" : !string.IsNullOrWhiteSpace(qso.QrzId) ? "logged" : "none",
                "QRZ Logbook",
                qso.QrzConfirmedAt.HasValue || string.Equals(qso.QrzConfirmationStatus, "C", StringComparison.OrdinalIgnoreCase)
                    ? "Confirmed in QRZ."
                    : !string.IsNullOrWhiteSpace(qso.QrzId)
                        ? "Present in QRZ logbook."
                        : "No QRZ logbook activity recorded.",
                qso.QrzConfirmedAt,
                qso.QrzQslDate)
        ];
    }

    private static QsoAnalysisQslDto BuildQsl(string provider, string status, string label, string description, DateTime? confirmedAt, DateTime? lastUpdatedAt) =>
        new(provider, status, label, description, EnsureUtc(confirmedAt), EnsureUtc(lastUpdatedAt));

    private static QsoAnalysisDataIssueDto[] BuildDataIssues(QsoEntry qso)
    {
        var issues = new List<QsoAnalysisDataIssueDto>();
        AddMissing(issues, "locator", "Worked locator", qso.Locator, "warning", "Worked station grid is missing, so path calculations are partial.");
        AddMissing(issues, "myGrid", "Own grid", qso.MyGridsquare, "warning", "Own station grid is missing, so path calculations are partial.");
        AddMissing(issues, "dxcc", "DXCC", qso.Dxcc, "warning", "DXCC is missing, so country-based award analysis is limited.");
        AddMissing(issues, "continent", "Continent", qso.Continent, "warning", "Continent is missing, so WAC-style analysis is limited.");
        AddMissing(issues, "cqZone", "CQ zone", qso.CqZone, "warning", "CQ zone is missing, so zone award analysis is limited.");
        AddMissing(issues, "ituZone", "ITU zone", qso.ItuZone, "warning", "ITU zone is missing, so ITU zone analysis is limited.");
        AddMissing(issues, "rstSent", "RST sent", qso.RstSent, "warning", "RST sent is missing.");
        AddMissing(issues, "rstReceived", "RST received", qso.RstReceived, "warning", "RST received is missing.");
        AddMissing(issues, "txPower", "TX power", qso.TxPower, "warning", "Transmit power is missing.");
        return issues.ToArray();
    }

    private async Task<List<QsoEntry>> LoadDuplicateCandidatesAsync(QsoEntry qso, CancellationToken ct)
    {
        var lower = qso.DateUtc.AddHours(-2).AddSeconds(-60);
        var upper = qso.DateUtc.AddHours(2).AddSeconds(60);
        var normalizedWorkedCallsign = NormalizeCallsign(qso.WorkedCallsign);
        return await _context.QsoEntries
            .Where(existing =>
                existing.UserId == qso.UserId &&
                existing.Id != qso.Id &&
                existing.WorkedCallsign.Trim().ToUpper() == normalizedWorkedCallsign &&
                existing.Mode == qso.Mode &&
                existing.DateUtc >= lower &&
                existing.DateUtc <= upper)
            .ToListAsync(ct);
    }

    private static QsoAnalysisDuplicateRiskDto BuildDuplicateRisk(QsoEntry qso, IReadOnlyCollection<QsoEntry> candidates)
    {
        var matches = candidates
            .Where(existing => QsoIdentity.IsDuplicateCandidate(
                existing,
                qso.UserId,
                qso.OwnCallsign,
                qso.WorkedCallsign,
                qso.DateUtc,
                qso.Band,
                qso.Mode,
                TimeSpan.FromSeconds(60),
                allowLocalTimeOffset: true))
            .Select(existing =>
            {
                var deltaSeconds = Math.Abs((existing.DateUtc - qso.DateUtc).TotalSeconds);
                var localTimeOffsetRisk = deltaSeconds > 60 &&
                    (Math.Abs(deltaSeconds - TimeSpan.FromHours(1).TotalSeconds) <= 60 ||
                     Math.Abs(deltaSeconds - TimeSpan.FromHours(2).TotalSeconds) <= 60);
                return new
                {
                    Qso = existing,
                    DeltaSeconds = deltaSeconds,
                    LocalTimeOffsetRisk = localTimeOffsetRisk
                };
            })
            .OrderBy(item => item.DeltaSeconds)
            .ToArray();

        if (matches.Length == 0)
            return new QsoAnalysisDuplicateRiskDto(0, 0, null, null, false);

        var closest = matches[0];
        var score = Math.Min(100, 50 + matches.Length * 20 + (closest.DeltaSeconds <= 60 ? 20 : 0) + (matches.Any(item => item.LocalTimeOffsetRisk) ? 10 : 0));
        return new QsoAnalysisDuplicateRiskDto(
            score,
            matches.Length,
            closest.Qso.Id,
            Math.Round(closest.DeltaSeconds, 1),
            matches.Any(item => item.LocalTimeOffsetRisk));
    }

    private static string BuildDuplicateCandidatesHash(IEnumerable<QsoEntry> candidates) =>
        string.Join("|", candidates
            .OrderBy(candidate => candidate.Id)
            .Select(candidate => string.Join(":",
                candidate.Id,
                EnsureUtc(candidate.DateUtc).ToString("O"),
                candidate.UpdatedAt.ToUniversalTime().ToString("O"),
                NormalizeCallsign(candidate.OwnCallsign),
                NormalizeCallsign(candidate.WorkedCallsign),
                candidate.Band,
                candidate.Mode)));

    private async Task<QsoAnalysis> SaveAnalysisAsync(QsoEntry qso, QsoAnalysis analysis, CancellationToken ct)
    {
        var isNewAnalysis = qso.Analysis is not null && ReferenceEquals(qso.Analysis, analysis) && analysis.Id == 0;

        try
        {
            await _context.SaveChangesAsync(ct);
            return analysis;
        }
        catch (DbUpdateException) when (isNewAnalysis)
        {
            _context.Entry(analysis).State = EntityState.Detached;
            qso.Analysis = await _context.QsoAnalyses
                .AsNoTracking()
                .SingleOrDefaultAsync(item => item.QsoId == qso.Id, ct);

            if (qso.Analysis is not null)
                return qso.Analysis;

            throw;
        }
    }

    private static QsoAnalysisPropagationDto BuildPropagation(QsoConditionsDto conditions)
    {
        var facts = conditions.Propagation.BandConditions
            .Where(item => item.IsCurrentQsoBand)
            .Select(item => $"{item.Band}: {item.Rating} - {item.Reason}")
            .DefaultIfEmpty(conditions.Propagation.Path?.Summary ?? "Path details are partial.")
            .ToArray();

        return new QsoAnalysisPropagationDto(
            conditions.DistanceKm,
            conditions.BearingDegrees,
            conditions.Propagation.Path?.Summary ?? "Unknown",
            facts);
    }

    private static QsoAnalysisSunDto BuildSun(QsoConditionsDto conditions) =>
        new(
            conditions.Propagation.Path?.OwnSolarElevationDegrees,
            conditions.Propagation.Path?.WorkedSolarElevationDegrees,
            conditions.Propagation.Path?.MidpointSolarElevationDegrees,
            conditions.Propagation.Path?.Summary ?? "Unknown");

    private static QsoAnalysisFlagDto[] BuildFlags(
        QsoAnalysisQslDto[] qsl,
        QsoAnalysisDataIssueDto[] issues,
        QsoAnalysisDuplicateRiskDto duplicateRisk)
    {
        var flags = new List<QsoAnalysisFlagDto>();
        if (qsl.Any(item => item.Status == "confirmed"))
            flags.Add(new QsoAnalysisFlagDto("confirmed", "Confirmed", "info", "At least one external log source confirms this QSO."));
        if (issues.Length > 0)
            flags.Add(new QsoAnalysisFlagDto("missing-data", "Missing data", "warning", "Some analysis inputs are missing."));
        if (duplicateRisk.CandidateCount > 0)
            flags.Add(new QsoAnalysisFlagDto("duplicate-risk", "Duplicate risk", duplicateRisk.LocalTimeOffsetRisk ? "warning" : "info", "Similar QSOs were found within the duplicate detection window."));
        return flags.ToArray();
    }

    private static QsoAnalysisScoresDto BuildScores(
        QsoAnalysisQslDto[] qsl,
        QsoAnalysisDataIssueDto[] issues,
        QsoAnalysisAwardImpactDto awards,
        QsoAnalysisPropagationDto propagation,
        QsoAnalysisDuplicateRiskDto duplicateRisk)
    {
        var confirmation = qsl.Any(item => item.Status == "confirmed")
            ? 100
            : qsl.Any(item => item.Status is "sent" or "logged" or "activity")
                ? 60
                : 0;
        var dataQuality = Math.Max(0, 100 - issues.Length * 10);
        var awardImpact = awards.ContributesTo.Length == 0
            ? Math.Max(20, 60 - awards.BlockedByMissingFields.Length * 5)
            : Math.Min(100, 50 + awards.ContributesTo.Length * 5 + awards.ConfirmationSources.Length * 10 - awards.BlockedByMissingFields.Length * 3);
        var propagationScore = 100;
        if (!propagation.DistanceKm.HasValue) propagationScore -= 35;
        if (string.Equals(propagation.PathLight, "Unknown", StringComparison.OrdinalIgnoreCase)) propagationScore -= 25;
        if (propagation.BandFacts.Length == 0) propagationScore -= 10;
        propagationScore = Math.Max(0, propagationScore);
        var duplicateScore = duplicateRisk.Score;
        var overall = (int)Math.Round((confirmation * 0.3) + (dataQuality * 0.25) + (awardImpact * 0.15) + (propagationScore * 0.2) + ((100 - duplicateScore) * 0.1));
        return new QsoAnalysisScoresDto(overall, confirmation, dataQuality, awardImpact, propagationScore, duplicateScore);
    }

    private static string[] BuildHighlights(
        QsoAnalysisQslDto[] qsl,
        QsoAnalysisAwardImpactDto awards,
        QsoAnalysisPropagationDto propagation,
        QsoAnalysisDuplicateRiskDto duplicateRisk)
    {
        var highlights = new List<string>();
        var confirmedProviders = qsl.Where(item => item.Status == "confirmed").Select(item => item.Provider).ToArray();
        if (confirmedProviders.Length > 0)
            highlights.Add($"Confirmed via {string.Join(", ", confirmedProviders)}");
        if (awards.ContributesTo.Length > 0)
            highlights.Add($"Counts toward {awards.ContributesTo[0]}");
        if (propagation.DistanceKm.HasValue)
            highlights.Add($"{Math.Round(propagation.DistanceKm.Value)} km path");
        if (duplicateRisk.CandidateCount > 0)
            highlights.Add($"Duplicate risk: {duplicateRisk.CandidateCount} nearby candidate(s)");
        return highlights.ToArray();
    }

    private static QsoAnalysisResponse ToResponse(QsoAnalysis analysis)
    {
        var scores = new QsoAnalysisScoresDto(
            analysis.OverallScore,
            analysis.ConfirmationScore,
            analysis.DataQualityScore,
            analysis.AwardImpactScore,
            analysis.PropagationScore,
            analysis.DuplicateRiskScore);

        return new QsoAnalysisResponse(
            analysis.Id,
            analysis.QsoId,
            EnsureUtc(analysis.GeneratedAtUtc),
            analysis.AnalysisVersion,
            scores,
            Deserialize(analysis.HighlightsJson, Array.Empty<string>()),
            Deserialize(analysis.FlagsJson, Array.Empty<QsoAnalysisFlagDto>()),
            Deserialize(analysis.QslJson, Array.Empty<QsoAnalysisQslDto>()),
            Deserialize(analysis.AwardImpactJson, new QsoAnalysisAwardImpactDto(Array.Empty<string>(), Array.Empty<string>(), Array.Empty<string>())),
            Deserialize(analysis.PropagationJson, new QsoAnalysisPropagationDto(null, null, "Unknown", Array.Empty<string>())),
            Deserialize(analysis.SunJson, new QsoAnalysisSunDto(null, null, null, "Unknown")),
            Deserialize(analysis.WeatherJson, new QsoAnalysisWeatherDto(null, null, string.Empty)),
            Deserialize(analysis.MissingDataJson, Array.Empty<QsoAnalysisDataIssueDto>()),
            Deserialize(analysis.DuplicateRiskJson, new QsoAnalysisDuplicateRiskDto(0, 0, null, null, false)),
            analysis.StoryText);
    }

    private static T Deserialize<T>(string json, T fallback)
    {
        try
        {
            return JsonSerializer.Deserialize<T>(json, JsonOptions) ?? fallback;
        }
        catch (JsonException)
        {
            return fallback;
        }
    }

    private static DateTime EnsureUtc(DateTime value) =>
        value.Kind == DateTimeKind.Utc ? value : DateTime.SpecifyKind(value, DateTimeKind.Utc);

    private static DateTime? EnsureUtc(DateTime? value) => value.HasValue ? EnsureUtc(value.Value) : null;

    private static string NormalizeCallsign(string callsign) => callsign.Trim().ToUpperInvariant();

    private static void AddMissing(List<QsoAnalysisDataIssueDto> issues, string field, string label, string? value, string severity, string description)
    {
        if (string.IsNullOrWhiteSpace(value))
            issues.Add(new QsoAnalysisDataIssueDto(field, label, severity, description));
    }

    private static void AddMissing(List<QsoAnalysisDataIssueDto> issues, string field, string label, int? value, string severity, string description)
    {
        if (!value.HasValue || value.Value <= 0)
            issues.Add(new QsoAnalysisDataIssueDto(field, label, severity, description));
    }

    private static void AddMissing(List<QsoAnalysisDataIssueDto> issues, string field, string label, double? value, string severity, string description)
    {
        if (!value.HasValue || value.Value <= 0)
            issues.Add(new QsoAnalysisDataIssueDto(field, label, severity, description));
    }
}
