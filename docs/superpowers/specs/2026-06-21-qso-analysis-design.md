# QSO Analysis Design

## Goal

Add an Analysis tab as the last tab on each QSO detail page. The tab should give both a practical inspection of the QSO and a readable, rule-based story. The first version must not depend on AI, but the analysis model should be structured so a later AI explanation can reuse the same facts.

The analysis should be useful even when some data is missing. It should explain what is known, what is uncertain, and what the user can improve.

## User Experience

The QSO detail page gets a final tab named `Analysis` / `Analyse`.

The tab shows:

- Overall summary: health score, confirmation state, data quality, award usefulness, propagation usefulness, duplicate/time risk.
- QSL and sync: QRZ, LoTW and eQSL status with short explanations.
- Award impact: which award tracks the QSO contributes to, plus missing fields that limit award credit.
- Propagation, sun and weather: path distance, bearing, daylight/greyline/darkness, solar elevations, weather at own and worked location, and NOAA/MUF/foF2 data where available.
- Data quality: actionable warnings for missing or suspicious data.
- Duplicate and time risk: whether the QSO resembles another QSO or has a known local/UTC offset risk.
- QSO story: a concise rule-based narrative built from the structured facts.

The tab should use dense, operational UI consistent with the current logbook detail page: compact cards, badges, small tables and short paragraphs. It should not become a marketing-style page.

## Backend Architecture

Add a `QsoAnalysis` entity and `QsoAnalyses` table. This table is a calculated snapshot/cache, not the source of truth.

Suggested columns:

- `Id`
- `QsoId`
- `UserId`
- `GeneratedAtUtc`
- `AnalysisVersion`
- `InputHash`
- `OverallScore`
- `ConfirmationScore`
- `DataQualityScore`
- `AwardImpactScore`
- `PropagationScore`
- `DuplicateRiskScore`
- `FlagsJson`
- `HighlightsJson`
- `MissingDataJson`
- `AwardImpactJson`
- `QslJson`
- `PropagationJson`
- `SunJson`
- `WeatherJson`
- `DuplicateRiskJson`
- `StoryText`

Indexes:

- Unique index on `QsoId`
- Index on `UserId, GeneratedAtUtc`
- Index on `UserId, OverallScore`
- Index on `UserId, DataQualityScore`

Add `GET /api/qsos/{id}/analysis`.

The endpoint:

1. Authorizes the current user against the QSO.
2. Loads the QSO and related user data.
3. Computes an input hash from fields that affect analysis: QSO fields, QSL fields, award fields, grid/location fields, and analysis version.
4. Returns cached analysis when `InputHash` and `AnalysisVersion` match.
5. Regenerates and stores a new analysis when stale or missing.

The first implementation may generate on demand only. A later batch/backfill endpoint can populate the table for all QSO records.

## Analysis Rules

### Scoring

Scores should be deterministic integers from 0 to 100:

- `OverallScore`: weighted summary of confirmation, data quality, award impact, propagation completeness and duplicate risk.
- `ConfirmationScore`: strongest when LoTW/eQSL/QRZ confirmed, medium when sent/synced, lower when not configured or no status.
- `DataQualityScore`: based on required and useful fields such as UTC time, own call, worked call, band, mode, worked grid, own grid, DXCC, continent, zones and award references.
- `AwardImpactScore`: based on available award entities and confirmed sources. It can start with "contributes to" logic and missing-data limits; it does not need to determine every "new entity" in version 1.
- `PropagationScore`: based on availability and coherence of grid/path/sun/weather/NOAA data.
- `DuplicateRiskScore`: higher when another QSO by same user has same call/mode/band near the timestamp or known local offset.

### QSL and Sync

Use existing QSO fields:

- QRZ: `QrzId`, `QrzConfirmationStatus`, `QrzConfirmedAt`, `QrzQslDate`
- LoTW: `LotwConfirmedAt`, `LotwQslDate`, `LotwLastResult`
- eQSL: `EqslSentAt`, `EqslConfirmedAt`, `EqslLastResult`

The analysis should distinguish:

- Confirmed
- Sent/synced but not confirmed
- Ready or not checked
- Credential/integration issue when detectable through external-status logic

### Award Impact

Use the existing award engine and QSO fields:

- DXCC, band slot, mode slot
- Continent/WAC
- Prefix/WPX
- Grid
- CQ zone, ITU zone
- US/Canada state or province when relevant
- County when relevant
- IOTA
- POTA/SOTA/generic award references

Version 1 should return:

- Tracks this QSO can contribute to
- Tracks blocked by missing data
- Confirmation sources that can count toward confirmed progress

### Propagation, Sun and Weather

Reuse `QsoConditionsBuilder`, weather service, NOAA propagation service and MUF/foF2 data already used by the QSO detail page.

Return:

- Own and worked grid/coordinates when available
- Distance and bearing
- Midpoint coordinates when available
- Solar elevation at own location, worked location and midpoint
- Path light classification: daylight, darkness, greyline, mixed or unknown
- Weather at own and worked location when grid is available
- NOAA/solar metrics and nearest timestamp information
- Band-condition facts already calculated for the QSO

### Data Quality

Return a list of issues with severity:

- `critical`: prevents core analysis, duplicate matching or award credit
- `warning`: reduces confidence or blocks some awards
- `info`: useful improvement

Examples:

- Missing worked locator
- Missing own grid
- Missing DXCC
- Missing continent
- Missing CQ/ITU zone
- Missing RST
- Missing TX power
- Missing IOTA/POTA/SOTA reference when comments suggest one, if detectable later

### Duplicate and Time Risk

Reuse the duplicate-candidate rules already used by QSO creation and duplicate tools.

Return:

- Risk score
- Candidate count
- Closest candidate summary
- Time delta seconds
- Whether the risk is exact-time or local-time-offset based

The analysis must treat UTC as canonical.

## DTO Shape

Frontend DTO should be explicit and stable:

- `id`
- `qsoId`
- `generatedAtUtc`
- `analysisVersion`
- `scores`
- `highlights`
- `flags`
- `qsl`
- `awardImpact`
- `propagation`
- `sun`
- `weather`
- `dataQuality`
- `duplicateRisk`
- `storyText`

JSON payloads stored in the database should follow the same logical sections. This keeps future analytics possible without needing to parse prose.

## Frontend Architecture

Add `analysis` to the QSO detail tab state:

`details | map | conditions | propagation | qsl | analysis`

Add `api.qsos.getAnalysis(id)`.

Add focused UI helpers for:

- Score tone
- Issue severity tone
- Path light label
- QSL status label

Keep rendering inside the existing QSO detail page initially. If the tab becomes large, extract `QsoAnalysisTab.tsx` after the first working version.

## Error Handling

If analysis cannot be generated:

- Show a concise error in the Analysis tab.
- Do not block editing the QSO.
- Do not overwrite existing cached analysis unless regeneration succeeds.

If optional data is unavailable:

- Return partial analysis with warnings.
- Mark unavailable weather/propagation/sun sections as unknown.

## Testing

Backend tests:

- Analysis creates and caches a snapshot.
- Analysis regenerates when input hash changes.
- Confirmed QSL sources raise confirmation score.
- Missing locator/grid lowers data quality and produces warnings.
- Duplicate candidates raise duplicate risk.
- UTC/local offset duplicate risk is detected.
- LoTW/eQSL/QRZ statuses are represented correctly.

Frontend tests:

- Score helper maps score ranges to expected tones.
- Data quality helper sorts critical/warning/info.
- QSO story renders useful text when optional data is missing.

Manual verification:

- Open a confirmed OZ4MT QSO and verify LoTW confirmation appears in analysis.
- Open a QSO missing locator and verify weather/path limitations are explained.
- Open a possible duplicate and verify duplicate risk appears.

## Future AI Layer

Later, add an optional AI button that sends the structured analysis DTO, not raw database objects, to an AI service. The AI should write a deeper explanation but should not invent facts. The stored `QsoAnalyses` rows become the stable input for both AI and future overall analytics.

## Out of Scope For Version 1

- Automatic AI text generation.
- Global analytics dashboard across all QSO analyses.
- Full "new award entity at time of QSO" historical diff. Version 1 can say what the QSO contributes to and what is blocked by missing fields.
- Background backfill for every user. On-demand generation is enough for the first implementation.
