# QSO Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a rule-based QSO Analysis tab backed by a cached `QsoAnalyses` table and a structured `/api/qsos/{id}/analysis` endpoint.

**Architecture:** Backend generates a deterministic analysis snapshot from QSO, QSL, award, duplicate, path, sun and weather/propagation data. The snapshot is stored as JSON sections plus scores, keyed by `QsoId`, `AnalysisVersion` and `InputHash`. Frontend adds a final Analysis tab on the existing QSO detail page and renders the structured facts plus a rule-based story.

**Tech Stack:** .NET 8, ASP.NET Core, EF Core/Npgsql, xUnit, Next.js 16, TypeScript, node:test, existing HamHub UI components.

## Global Constraints

- Analysis is rule-based only; no AI call in version 1.
- `QsoAnalyses` is a calculated snapshot/cache, not the source of truth.
- UTC is canonical for duplicate/time analysis.
- First implementation is on-demand generation through `GET /api/qsos/{id}/analysis`; no global backfill job in version 1.
- UI must stay dense and operational, consistent with current QSO detail tabs.
- Optional data must produce partial analysis and warnings, not hard failures.

---

## File Structure

- Create `backend/HamHub.Domain/Entities/QsoAnalysis.cs`: persisted snapshot entity.
- Modify `backend/HamHub.Domain/Entities/QsoEntry.cs`: navigation property to analysis.
- Modify `backend/HamHub.Infrastructure/Persistence/ApplicationDbContext.cs`: add `DbSet<QsoAnalysis>`.
- Create `backend/HamHub.Infrastructure/Persistence/Configurations/QsoAnalysisConfiguration.cs`: indexes, lengths, JSON column mapping.
- Create EF migration under `backend/HamHub.Infrastructure/Migrations/`: create `QsoAnalyses`.
- Modify `backend/HamHub.Api/Program.cs`: startup schema guard for production deployments.
- Create `backend/HamHub.Api/Services/QsoAnalysisDtos.cs`: response DTO records.
- Create `backend/HamHub.Api/Services/QsoAnalysisService.cs`: generator/cache orchestration.
- Create `backend/HamHub.Api/Services/QsoAnalysisInputHasher.cs`: deterministic input hash.
- Create `backend/HamHub.Api/Services/QsoAnalysisStoryBuilder.cs`: rule-based narrative.
- Modify `backend/HamHub.Api/Controllers/QsosController.cs`: add `GET {id}/analysis`.
- Create/modify backend tests in `backend/HamHub.Api.Tests/QsoAnalysisServiceTests.cs` and `backend/HamHub.Api.Tests/QsosControllerAnalysisTests.cs`.
- Modify `frontend/src/lib/types.ts`: add analysis DTO types.
- Modify `frontend/src/lib/api.ts`: add `api.qsos.getAnalysis(id)`.
- Create `frontend/src/app/logbook/qsoAnalysis.ts`: UI helper functions.
- Create `frontend/src/app/logbook/qsoAnalysis.test.ts`: helper tests.
- Modify `frontend/src/app/logbook/[id]/page.tsx`: add Analysis tab and renderer.
- Modify `frontend/src/i18n/translations/en.ts` and `frontend/src/i18n/translations/da.ts`: labels/copy.

---

### Task 1: Persisted Analysis Snapshot

**Files:**
- Create: `backend/HamHub.Domain/Entities/QsoAnalysis.cs`
- Modify: `backend/HamHub.Domain/Entities/QsoEntry.cs`
- Modify: `backend/HamHub.Infrastructure/Persistence/ApplicationDbContext.cs`
- Create: `backend/HamHub.Infrastructure/Persistence/Configurations/QsoAnalysisConfiguration.cs`
- Create migration: `backend/HamHub.Infrastructure/Migrations/*_AddQsoAnalyses.cs`
- Modify: `backend/HamHub.Api/Program.cs`
- Test: `backend/HamHub.Api.Tests/QsoAnalysisPersistenceTests.cs`

**Interfaces:**
- Produces entity: `QsoAnalysis`
- Produces DbSet: `ApplicationDbContext.QsoAnalyses`
- Produces unique cache key: one row per `QsoId`

- [ ] **Step 1: Write failing persistence test**

Create `backend/HamHub.Api.Tests/QsoAnalysisPersistenceTests.cs`:

```csharp
using HamHub.Domain.Entities;
using HamHub.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HamHub.Api.Tests;

public class QsoAnalysisPersistenceTests
{
    [Fact]
    public async Task QsoAnalysisCanBeStoredAndLoadedByQsoId()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        await using var db = new ApplicationDbContext(options);
        var user = new ApplicationUser { Id = "user-1", Email = "test@example.com", UserName = "test@example.com", Callsign = "OZ4MT" };
        var qso = new QsoEntry
        {
            Id = 1,
            UserId = user.Id,
            User = user,
            DateUtc = new DateTime(2026, 6, 21, 10, 0, 0, DateTimeKind.Utc),
            OwnCallsign = "OZ4MT",
            WorkedCallsign = "E74K",
            Band = HamHub.Domain.Enums.Band.M20,
            Mode = HamHub.Domain.Enums.Mode.FT8
        };

        db.Users.Add(user);
        db.QsoEntries.Add(qso);
        db.QsoAnalyses.Add(new QsoAnalysis
        {
            QsoId = qso.Id,
            UserId = user.Id,
            GeneratedAtUtc = DateTime.UtcNow,
            AnalysisVersion = 1,
            InputHash = "hash-1",
            OverallScore = 80,
            ConfirmationScore = 100,
            DataQualityScore = 70,
            AwardImpactScore = 60,
            PropagationScore = 50,
            DuplicateRiskScore = 0,
            HighlightsJson = "[]",
            FlagsJson = "[]",
            MissingDataJson = "[]",
            AwardImpactJson = "{}",
            QslJson = "{}",
            PropagationJson = "{}",
            SunJson = "{}",
            WeatherJson = "{}",
            DuplicateRiskJson = "{}",
            StoryText = "This QSO is confirmed."
        });
        await db.SaveChangesAsync();

        var stored = await db.QsoAnalyses.SingleAsync(a => a.QsoId == qso.Id);

        Assert.Equal("user-1", stored.UserId);
        Assert.Equal(80, stored.OverallScore);
        Assert.Equal("This QSO is confirmed.", stored.StoryText);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test backend\HamHub.Api.Tests\HamHub.Api.Tests.csproj --filter QsoAnalysisPersistenceTests`

Expected: FAIL because `QsoAnalysis` and `QsoAnalyses` do not exist.

- [ ] **Step 3: Add entity and DbContext wiring**

Create `backend/HamHub.Domain/Entities/QsoAnalysis.cs`:

```csharp
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
```

Modify `QsoEntry.cs`:

```csharp
public QsoAnalysis? Analysis { get; set; }
```

Modify `ApplicationDbContext.cs`:

```csharp
public DbSet<QsoAnalysis> QsoAnalyses => Set<QsoAnalysis>();
```

- [ ] **Step 4: Add EF configuration**

Create `backend/HamHub.Infrastructure/Persistence/Configurations/QsoAnalysisConfiguration.cs`:

```csharp
using HamHub.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HamHub.Infrastructure.Persistence.Configurations;

public class QsoAnalysisConfiguration : IEntityTypeConfiguration<QsoAnalysis>
{
    public void Configure(EntityTypeBuilder<QsoAnalysis> builder)
    {
        builder.HasIndex(a => a.QsoId).IsUnique();
        builder.HasIndex(a => new { a.UserId, a.GeneratedAtUtc });
        builder.HasIndex(a => new { a.UserId, a.OverallScore });
        builder.HasIndex(a => new { a.UserId, a.DataQualityScore });

        builder.Property(a => a.InputHash).HasMaxLength(128);
        builder.Property(a => a.StoryText).HasMaxLength(4000);

        builder.HasOne(a => a.Qso)
            .WithOne(q => q.Analysis)
            .HasForeignKey<QsoAnalysis>(a => a.QsoId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(a => a.User)
            .WithMany()
            .HasForeignKey(a => a.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
```

- [ ] **Step 5: Add migration and startup schema guard**

Run: `dotnet ef migrations add AddQsoAnalyses --project backend\HamHub.Infrastructure --startup-project backend\HamHub.Api`

Modify `backend/HamHub.Api/Program.cs` by adding a startup schema guard equivalent to existing LoTW/award guards:

```csharp
await TryEnsureSchemaAsync("QSO analyses", () => EnsureQsoAnalysisSchemaAsync(context), app.Logger);
```

Add method:

```csharp
static async Task EnsureQsoAnalysisSchemaAsync(ApplicationDbContext context)
{
    await context.Database.ExecuteSqlRawAsync("""
        CREATE TABLE IF NOT EXISTS "QsoAnalyses" (
            "Id" integer GENERATED BY DEFAULT AS IDENTITY,
            "QsoId" integer NOT NULL,
            "UserId" text NOT NULL,
            "GeneratedAtUtc" timestamp with time zone NOT NULL,
            "AnalysisVersion" integer NOT NULL,
            "InputHash" character varying(128) NOT NULL,
            "OverallScore" integer NOT NULL,
            "ConfirmationScore" integer NOT NULL,
            "DataQualityScore" integer NOT NULL,
            "AwardImpactScore" integer NOT NULL,
            "PropagationScore" integer NOT NULL,
            "DuplicateRiskScore" integer NOT NULL,
            "FlagsJson" text NOT NULL,
            "HighlightsJson" text NOT NULL,
            "MissingDataJson" text NOT NULL,
            "AwardImpactJson" text NOT NULL,
            "QslJson" text NOT NULL,
            "PropagationJson" text NOT NULL,
            "SunJson" text NOT NULL,
            "WeatherJson" text NOT NULL,
            "DuplicateRiskJson" text NOT NULL,
            "StoryText" character varying(4000) NOT NULL,
            CONSTRAINT "PK_QsoAnalyses" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_QsoAnalyses_QsoEntries_QsoId" FOREIGN KEY ("QsoId") REFERENCES "QsoEntries" ("Id") ON DELETE CASCADE,
            CONSTRAINT "FK_QsoAnalyses_AspNetUsers_UserId" FOREIGN KEY ("UserId") REFERENCES "AspNetUsers" ("Id") ON DELETE CASCADE
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_QsoAnalyses_QsoId" ON "QsoAnalyses" ("QsoId");
        CREATE INDEX IF NOT EXISTS "IX_QsoAnalyses_UserId_GeneratedAtUtc" ON "QsoAnalyses" ("UserId", "GeneratedAtUtc");
        CREATE INDEX IF NOT EXISTS "IX_QsoAnalyses_UserId_OverallScore" ON "QsoAnalyses" ("UserId", "OverallScore");
        CREATE INDEX IF NOT EXISTS "IX_QsoAnalyses_UserId_DataQualityScore" ON "QsoAnalyses" ("UserId", "DataQualityScore");
        """);
}
```

- [ ] **Step 6: Verify**

Run: `dotnet test backend\HamHub.Api.Tests\HamHub.Api.Tests.csproj --filter QsoAnalysisPersistenceTests`

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```powershell
git add backend/HamHub.Domain backend/HamHub.Infrastructure backend/HamHub.Api backend/HamHub.Api.Tests
git commit -m "Add QSO analysis persistence"
```

---

### Task 2: Backend Analysis Generator and Endpoint

**Files:**
- Create: `backend/HamHub.Api/Services/QsoAnalysisDtos.cs`
- Create: `backend/HamHub.Api/Services/QsoAnalysisInputHasher.cs`
- Create: `backend/HamHub.Api/Services/QsoAnalysisStoryBuilder.cs`
- Create: `backend/HamHub.Api/Services/QsoAnalysisService.cs`
- Modify: `backend/HamHub.Api/Program.cs`
- Modify: `backend/HamHub.Api/Controllers/QsosController.cs`
- Test: `backend/HamHub.Api.Tests/QsoAnalysisServiceTests.cs`

**Interfaces:**
- Produces: `Task<QsoAnalysisResponse> GetOrCreateAsync(int qsoId, string userId, bool isAdmin, CancellationToken ct)`
- Consumes: `ApplicationDbContext`, `QsoConditionsBuilder`, `AwardEngine` patterns, existing duplicate identity rules.
- Produces API: `GET /api/qsos/{id}/analysis`

- [ ] **Step 1: Write failing service tests**

Create `backend/HamHub.Api.Tests/QsoAnalysisServiceTests.cs` with tests:

```csharp
[Fact]
public async Task AnalysisMarksConfirmedQsoAndBuildsStory()
{
    // Arrange an FT8 QSO with LoTW confirmation, DXCC, grids and zones.
    // Act: QsoAnalysisService.GetOrCreateAsync(qso.Id, user.Id, false, CancellationToken.None)
    // Assert: ConfirmationScore is 100, QSL LoTW status is confirmed, StoryText mentions LoTW and FT8.
}

[Fact]
public async Task AnalysisWarnsWhenWorkedLocatorIsMissing()
{
    // Arrange QSO without Locator.
    // Assert: MissingData contains field "locator", severity "warning", and PropagationScore is lower than 100.
}

[Fact]
public async Task AnalysisDetectsDuplicateRiskWithinUtcWindow()
{
    // Arrange two same-call same-band same-mode QSOs within 45 seconds.
    // Assert: DuplicateRiskScore > 0 and duplicateRisk.candidateCount == 1.
}

[Fact]
public async Task AnalysisUsesCachedSnapshotWhenInputHashMatches()
{
    // Arrange existing QsoAnalysis with current hash.
    // Act twice.
    // Assert same GeneratedAtUtc is returned and only one row exists.
}
```

Use concrete assertions after DTOs are created in Step 2.

- [ ] **Step 2: Define DTOs**

Create `backend/HamHub.Api/Services/QsoAnalysisDtos.cs`:

```csharp
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
```

- [ ] **Step 3: Implement input hash**

Create `QsoAnalysisInputHasher.cs`:

```csharp
using System.Security.Cryptography;
using System.Text;
using HamHub.Domain.Entities;

namespace HamHub.Api.Services;

public static class QsoAnalysisInputHasher
{
    public static string Hash(QsoEntry qso, int analysisVersion)
    {
        var input = string.Join("|", new object?[]
        {
            analysisVersion,
            qso.DateUtc.ToUniversalTime().ToString("O"),
            qso.OwnCallsign,
            qso.WorkedCallsign,
            qso.Band,
            qso.Frequency,
            qso.Mode,
            qso.RstSent,
            qso.RstReceived,
            qso.Submode,
            qso.Locator,
            qso.MyGridsquare,
            qso.Country,
            qso.Dxcc,
            qso.Continent,
            qso.State,
            qso.CqZone,
            qso.ItuZone,
            qso.County,
            qso.Iota,
            qso.PotaRefs,
            qso.SotaRefs,
            qso.AwardRefs,
            qso.QrzId,
            qso.QrzConfirmationStatus,
            qso.QrzConfirmedAt?.ToUniversalTime().ToString("O"),
            qso.EqslSentAt?.ToUniversalTime().ToString("O"),
            qso.EqslConfirmedAt?.ToUniversalTime().ToString("O"),
            qso.LotwConfirmedAt?.ToUniversalTime().ToString("O"),
            qso.LotwQslDate?.ToUniversalTime().ToString("O"),
            qso.LotwLastResult
        });
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(input)));
    }
}
```

- [ ] **Step 4: Implement story builder**

Create `QsoAnalysisStoryBuilder.cs`:

```csharp
using HamHub.Domain.Entities;

namespace HamHub.Api.Services;

public static class QsoAnalysisStoryBuilder
{
    public static string Build(QsoEntry qso, QsoAnalysisScoresDto scores, QsoAnalysisAwardImpactDto awards, QsoAnalysisPropagationDto propagation)
    {
        var parts = new List<string>
        {
            $"This {qso.Mode} QSO with {qso.WorkedCallsign} on {qso.Band} was logged at {qso.DateUtc:yyyy-MM-dd HH:mm} UTC."
        };

        if (scores.Confirmation >= 100) parts.Add("It is confirmed by at least one external log source.");
        else if (scores.Confirmation >= 50) parts.Add("It has external log activity, but no full confirmation yet.");
        else parts.Add("It has not been confirmed by an external log source yet.");

        if (awards.ContributesTo.Length > 0) parts.Add($"It contributes to {string.Join(", ", awards.ContributesTo)} tracking.");
        if (propagation.DistanceKm.HasValue) parts.Add($"The path is approximately {Math.Round(propagation.DistanceKm.Value)} km.");
        if (awards.BlockedByMissingFields.Length > 0) parts.Add($"Some award or path analysis is limited by missing {string.Join(", ", awards.BlockedByMissingFields)}.");

        return string.Join(" ", parts);
    }
}
```

- [ ] **Step 5: Implement service**

Create `QsoAnalysisService.cs` with:

```csharp
public class QsoAnalysisService
{
    public const int AnalysisVersion = 1;
    public Task<QsoAnalysisResponse> GetOrCreateAsync(int qsoId, string userId, bool isAdmin, CancellationToken ct);
}
```

Implementation requirements:

- Load QSO with `Include(q => q.User)` and existing analysis.
- Forbid non-owner unless `isAdmin`.
- Build `QsoConditionsBuilder.Build(qso)` for path/sun facts.
- Use existing QSL fields to create `QsoAnalysisQslDto[]`.
- Build award contribution labels from QSO fields.
- Build missing-data issues from locator, my grid, DXCC, continent, CQ/ITU zone, RST and power.
- Find duplicate candidates from same user/call/band/mode within 60 seconds or around 2-hour offset.
- Serialize JSON sections using `System.Text.Json.JsonSerializer`.
- Store/update `QsoAnalysis`.

- [ ] **Step 6: Register service and endpoint**

Modify `Program.cs`:

```csharp
builder.Services.AddScoped<QsoAnalysisService>();
```

Modify `QsosController` constructor to accept `QsoAnalysisService`.

Add endpoint:

```csharp
[HttpGet("{id}/analysis")]
public async Task<IActionResult> GetAnalysis(int id, CancellationToken ct)
{
    var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
    if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();
    var analysis = await _analysisService.GetOrCreateAsync(id, userId, User.IsInRole("Admin"), ct);
    return Ok(analysis);
}
```

- [ ] **Step 7: Verify backend**

Run:

```powershell
dotnet test backend\HamHub.Api.Tests\HamHub.Api.Tests.csproj --filter "QsoAnalysisServiceTests|QsosControllerAnalysisTests"
dotnet test backend\HamHub.Api.Tests\HamHub.Api.Tests.csproj
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```powershell
git add backend/HamHub.Api backend/HamHub.Api.Tests
git commit -m "Add QSO analysis generator"
```

---

### Task 3: Frontend Analysis Tab

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/src/app/logbook/qsoAnalysis.ts`
- Create: `frontend/src/app/logbook/qsoAnalysis.test.ts`
- Modify: `frontend/src/app/logbook/[id]/page.tsx`
- Modify: `frontend/src/i18n/translations/en.ts`
- Modify: `frontend/src/i18n/translations/da.ts`

**Interfaces:**
- Consumes API: `api.qsos.getAnalysis(id): Promise<QsoAnalysis>`
- Produces UI tab: `analysis`

- [ ] **Step 1: Write frontend helper tests**

Create `frontend/src/app/logbook/qsoAnalysis.test.ts`:

```ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { issueTone, scoreTone, sortIssues } from './qsoAnalysis'

test('maps score ranges to tones', () => {
  assert.equal(scoreTone(90), 'good')
  assert.equal(scoreTone(65), 'warning')
  assert.equal(scoreTone(30), 'danger')
})

test('sorts data quality issues by severity', () => {
  const sorted = sortIssues([
    { field: 'txPower', label: 'Power', severity: 'info', description: '' },
    { field: 'locator', label: 'Grid', severity: 'warning', description: '' },
    { field: 'dateUtc', label: 'UTC', severity: 'critical', description: '' },
  ])
  assert.deepEqual(sorted.map(issue => issue.field), ['dateUtc', 'locator', 'txPower'])
})

test('maps issue severity to tones', () => {
  assert.equal(issueTone('critical'), 'danger')
  assert.equal(issueTone('warning'), 'warning')
  assert.equal(issueTone('info'), 'default')
})
```

- [ ] **Step 2: Add TypeScript types and API method**

Modify `frontend/src/lib/types.ts`:

```ts
export interface QsoAnalysis {
  id: number
  qsoId: number
  generatedAtUtc: string
  analysisVersion: number
  scores: QsoAnalysisScores
  highlights: string[]
  flags: QsoAnalysisFlag[]
  qsl: QsoAnalysisQsl[]
  awardImpact: QsoAnalysisAwardImpact
  propagation: QsoAnalysisPropagation
  sun: QsoAnalysisSun
  weather: QsoAnalysisWeather
  dataQuality: QsoAnalysisDataIssue[]
  duplicateRisk: QsoAnalysisDuplicateRisk
  storyText: string
}
```

Add related interfaces matching backend DTO.

Modify `frontend/src/lib/api.ts`:

```ts
getAnalysis: (id: number) => request<import('./types').QsoAnalysis>(`/api/qsos/${id}/analysis`),
```

- [ ] **Step 3: Implement helper functions**

Create `frontend/src/app/logbook/qsoAnalysis.ts`:

```ts
export type AnalysisTone = 'good' | 'warning' | 'danger' | 'default'

export function scoreTone(score: number): AnalysisTone {
  if (score >= 80) return 'good'
  if (score >= 50) return 'warning'
  return 'danger'
}

export function issueTone(severity: string): AnalysisTone {
  if (severity === 'critical') return 'danger'
  if (severity === 'warning') return 'warning'
  return 'default'
}

export function sortIssues<T extends { severity: string }>(issues: T[]): T[] {
  const weight = (severity: string) => severity === 'critical' ? 0 : severity === 'warning' ? 1 : 2
  return [...issues].sort((a, b) => weight(a.severity) - weight(b.severity))
}
```

- [ ] **Step 4: Add Analysis tab UI**

Modify `frontend/src/app/logbook/[id]/page.tsx`:

- Extend tab union with `analysis`.
- Add state: `analysis`, `analysisLoading`, `analysisError`.
- Load analysis when tab becomes active.
- Render final tab button after QSL.
- Render compact cards:
  - score cards
  - story text
  - QSL list
  - award impact list
  - propagation/sun/weather facts
  - data quality issues
  - duplicate risk

- [ ] **Step 5: Add translations**

Add keys in English and Danish:

```ts
'logbook.detail.tabs.analysis': 'Analysis',
'logbook.analysis.title': 'QSO analysis',
'logbook.analysis.story': 'QSO story',
'logbook.analysis.scores': 'Scores',
'logbook.analysis.qsl': 'QSL & sync',
'logbook.analysis.awards': 'Award impact',
'logbook.analysis.conditions': 'Propagation, sun & weather',
'logbook.analysis.dataQuality': 'Data quality',
'logbook.analysis.duplicates': 'Duplicate & time risk',
```

Danish equivalents:

```ts
'logbook.detail.tabs.analysis': 'Analyse',
'logbook.analysis.title': 'QSO analyse',
'logbook.analysis.story': 'QSO historie',
'logbook.analysis.scores': 'Scores',
'logbook.analysis.qsl': 'QSL & sync',
'logbook.analysis.awards': 'Award impact',
'logbook.analysis.conditions': 'Propagation, sol & vejr',
'logbook.analysis.dataQuality': 'Datakvalitet',
'logbook.analysis.duplicates': 'Dublet & tidsrisiko',
```

- [ ] **Step 6: Verify frontend**

Run:

```powershell
npm.cmd test -- src/app/logbook/qsoAnalysis.test.ts
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```powershell
git add frontend/src
git commit -m "Add QSO analysis tab"
```

---

### Task 4: End-to-End Verification and Deploy

**Files:**
- No planned source edits unless verification finds defects.

**Interfaces:**
- Consumes completed backend endpoint and frontend tab.
- Produces deployed production feature.

- [ ] **Step 1: Run full verification**

Run:

```powershell
npm.cmd run build
dotnet test backend\HamHub.Api.Tests\HamHub.Api.Tests.csproj
git diff --check
```

Expected:

- Next.js build completes.
- Backend test suite passes with only expected skipped live eQSL test.
- `git diff --check` has no whitespace errors.

- [ ] **Step 2: Smoke test locally if server is already available**

If a local dev server/API is running, open a known QSO detail and verify:

- Analysis tab appears last.
- Analysis loads.
- Missing locator QSO explains weather/path limitations.
- LoTW-confirmed QSO shows confirmed QSL status.

If no local server is running, do not block deploy on local manual UI smoke after automated build/tests pass.

- [ ] **Step 3: Push and deploy**

Run:

```powershell
git push origin master
gh run list --workflow "Deploy production" --branch master --limit 3
gh run watch <run-id> --exit-status
```

Expected: deploy workflow succeeds.

- [ ] **Step 4: Production smoke**

Run:

```powershell
Invoke-WebRequest -Uri https://hamhub.dk -UseBasicParsing -TimeoutSec 20
Invoke-WebRequest -Uri https://api.hamhub.dk/api/stations -UseBasicParsing -TimeoutSec 20
```

Expected: both return `200 OK`.

- [ ] **Step 5: Final report**

Report:

- Commits created.
- Tests/builds run.
- Deploy run URL.
- Any known limitations, especially that AI explanation and global analytics dashboard are future work.
