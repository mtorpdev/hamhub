# Awards Foundation Design

## Goal

Build a full awards foundation for HamHub while releasing award calculations in phases. The foundation should support a GridTracker-like overview across many award families, but the UI must clearly separate awards that are active from awards that need more data before their numbers can be trusted.

## Product Direction

Add a dedicated `/awards` area that becomes the authoritative place for award progress. Live Rooster keeps showing compact live opportunities, but it should eventually consume the same award calculation model so the roster and awards page never disagree about what is worked, confirmed, or needed.

The first implementation should follow the "full foundation, phased awards" approach:

- add the broad QSO data model needed for common awards now
- create a generic award definition and calculation layer now
- activate only the award families where HamHub has reliable data
- show the remaining catalog as "missing data" or "coming next" rather than hiding the roadmap

## Current Context

HamHub already stores core award fields on `QsoEntry`: callsign, date, own callsign, band, frequency, mode, submode, worked locator, own grid, country, numeric DXCC, continent, state, IOTA, QRZ ID, QRZ confirmation, eQSL confirmation, and LoTW confirmation.

The current Live Rooster frontend derives a partial award model from the authenticated user's logbook. It tracks callsigns, grids, band/mode slots, countries, confirmed countries, continents, prefixes, country bands, and country modes. This is enough for the current DXCC/grid/prefix live badges, but not enough for full WAZ, ITU, county, POTA, SOTA, IOTA, and sponsor-specific awards.

GridTracker's design has two useful lessons:

- It uses a large award catalog, but the calculations are built from a smaller set of reusable rule types such as DXCC, grids, calls, prefixes, states, counties, CQ zones, ITU zones, continents, IOTA, and per-band variants.
- It separates worked and confirmed indexes, then applies band/mode filters and award-specific rules on top.

## Data Model

Extend `QsoEntry` with first-class award fields:

- `CqZone`
- `ItuZone`
- `County`
- `MyState`
- `MyCounty`
- `PotaRefs`
- `SotaRefs`
- `AwardRefs`

Keep `Iota` as the primary IOTA field, but normalize it during import and save so values are comparable. `PotaRefs`, `SotaRefs`, and `AwardRefs` should allow multiple references because a single QSO can count for more than one park, summit, or special program.

The first implementation can store multi-reference fields as normalized delimited strings if that matches the existing EF migration style and keeps scope controlled. The award engine should expose them as arrays internally so a later normalized child table does not change consumers.

Confirmation remains derived from existing fields:

- LoTW confirmed
- eQSL confirmed
- QRZ confirmed
- QRZ confirmation status `C`

Awards that require a specific confirmation source should be able to express that later, but phase one treats any trusted QSL confirmation as confirmed.

## Data Enrichment

Award quality depends on QSO enrichment. The first backend pass should populate fields from the best available source in this order:

1. Direct user-entered or imported ADIF fields.
2. WSJT-X and QRZ/LoTW/eQSL data already attached to the QSO.
3. HamHub lookup services such as CTY/DXCC lookup.
4. Future external datasets for counties, POTA, SOTA, and IOTA.

The existing CTY-based DXCC lookup can provide country, DXCC, continent, CQ zone, ITU zone, and WPX prefix where available. If the current parser does not persist CQ/ITU zones yet, this work should extend that path rather than calculating zones only in the frontend.

County data is only reliable when the log/import/lookup provides it. HamHub should not infer counties from callsign alone except where a trusted lookup explicitly returns it.

## Award Catalog

Create a HamHub award catalog that is data-driven and inspired by GridTracker's rule categories, not a direct copy of every implementation detail. Each award definition should include:

- `id`
- `sponsor`
- `name`
- `description`
- `status`: `active`, `missing-data`, or `coming-next`
- `ruleType`
- `requiredCount` or endorsement thresholds
- optional band filters
- optional mode filters
- optional entity allow-list
- confirmation requirement
- data requirements

Phase one active catalog:

- DXCC
- DXCC by band
- DXCC by mode
- WAC
- WPX or prefix progress
- grid progress
- confirmed DXCC progress

Phase two catalog:

- WAZ / CQ zones
- ITU zones
- WAS / states
- Canadian provinces and territories

Phase three catalog:

- counties
- IOTA
- POTA
- SOTA
- special and club awards

## Award Engine

The backend should expose a reusable award engine that accepts:

- the user's QSOs
- selected own callsign or all owned callsigns
- optional date range
- optional band filter
- optional mode filter
- award catalog definitions

The engine should return:

- award summary cards
- worked count
- confirmed count
- next threshold
- missing entities
- worked but unconfirmed entities
- qualifying QSO examples
- data quality warnings
- whether the award is active, missing data, or coming next

Internally, it should build worked and confirmed indexes by reusable entity types:

- callsign
- DXCC
- grid
- prefix
- continent
- CQ zone
- ITU zone
- state/province
- county
- IOTA
- POTA
- SOTA

The engine should be backend-owned so `/awards`, `/logbook`, and `/decode` can share the same truth. Frontend-only scoring may remain temporarily for Live Rooster, but should be reduced over time.

## API

Add authenticated endpoints under an awards route:

- `GET /api/awards/catalog`
- `GET /api/awards/summary`
- `GET /api/awards/{id}`

`summary` should support query parameters for callsign, band, mode, status, and sponsor. The detail endpoint should return the missing/worked/confirmed entity rows for a single award.

The API should avoid returning every QSO for every award in the summary response. Award detail can include example QSO IDs so the UI can link to logbook entries.

## UI

Add `/awards` as a work-focused app page, not a marketing page.

The first viewport should show:

- compact filters for callsign, band, mode, sponsor, and status
- overall worked/confirmed counts
- active award progress cards
- data warnings for awards that cannot be fully calculated yet

Below that, show a scannable table of award definitions. Each row should show sponsor, award name, status, progress, next threshold, missing count, and confirmation gap.

Selecting an award opens a detail view or detail panel with:

- progress summary
- worked entities
- confirmed entities
- worked but unconfirmed entities
- missing entities
- matching QSOs or example QSO links
- explanation of missing data requirements

The UI should make it clear when an award is not active because data is missing. It should not present placeholder numbers as real progress.

## Live Rooster Integration

Live Rooster should continue using compact badges, but the award reason model should migrate toward the backend award entity model. A live station should be able to show:

- counts toward active awards
- "new for award" reasons
- "worked but needs confirmation" reasons
- data missing reasons when HamHub cannot evaluate an award reliably

Live operation should remain fast. The roster can use a cached award snapshot plus current decodes rather than calling the full award summary on every received decode.

## Data Imports And Sync

QRZ, LoTW, eQSL, WSJT-X, and manual entry should all feed the same QSO fields. Import paths should normalize:

- band
- mode and submode
- DXCC
- country
- continent
- state
- CQ zone
- ITU zone
- grid
- IOTA
- POTA/SOTA references when present

LoTW and eQSL member/activity lookup is separate from confirmation. Member/activity data can help Live Rooster labels, but award confirmation comes from matched QSL records on the QSO.

## Error Handling

Award calculations should degrade explicitly:

- Unknown fields are counted as unknown, not missing.
- Awards with incomplete required data get `missing-data` status.
- QSO rows with invalid refs should be ignored for that specific entity and surfaced in data warnings.
- API failures should not break logbook or live roster pages.

## Testing

Backend tests should cover:

- confirmation derivation
- DXCC worked versus confirmed
- band and mode filtering
- prefix counting
- grid counting
- CQ and ITU zone counting once fields exist
- missing-data status for awards whose required fields are absent
- API authorization and response shape

Frontend tests should cover:

- awards summary rendering
- active versus missing-data labels
- filters
- award detail entity lists
- empty and loading states

Run backend tests after entity, migration, API, or engine changes. Run frontend lint/build after `/awards` UI changes.

## Acceptance Criteria

- HamHub has first-class QSO fields for common award dimensions.
- A backend award engine calculates worked, confirmed, missing, and unconfirmed progress from QSO data.
- `/awards` gives a complete overview of active and future award families.
- Phase one awards show trustworthy real progress.
- Awards that need missing data are visible but clearly marked.
- Live Rooster can continue current behavior and has a clear path to reuse the backend award model.
- Existing logbook, QRZ, LoTW, eQSL, and WSJT-X logging flows remain compatible.

## Out Of Scope For First Implementation Plan

- Claiming or submitting awards to external sponsors.
- Downloading certificates.
- Full POTA/SOTA external dataset synchronization.
- Replacing all Live Rooster frontend scoring in one step.
- Directly importing GridTracker's full UI behavior.
