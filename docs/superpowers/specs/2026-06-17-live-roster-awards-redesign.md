# Live Roster and Awards Redesign

## Goal

Refactor the `/decode` live page into a GridTracker-like radio desk: one prioritized live roster, one selected-station work panel, and compact map/award context. The page should help an operator quickly decide who to work next without switching between several overlapping tables.

## Current Problem

`frontend/src/app/decode/page.tsx` has grown into a single large component that owns live decodes, map markers, wanted logic, award logic, WSJT-X command state, QSO lookup, and QSO editing. The UI now has separate grid, map, wanted, and awards views that repeat much of the same station information. This creates "double konfekt": multiple lists answer the same question, but none feels like the main operating workflow.

## Product Direction

Use a split layout:

- Left: Live Roster.
- Right top: Selected Station.
- Right lower area: Map and Award Progress.
- Raw decode grid: secondary/debug view, not the default experience.

The operator should mostly live in the roster and detail pane. Map and awards explain why a station matters, instead of becoming separate competing work queues.

## Live Roster

The roster groups live decodes by active callsign. One row represents one station, not one received message. Each row shows:

- callsign
- latest message
- latest decode time
- SNR
- band and mode
- grid
- country and continent
- distance when both grids are known
- status badges

Rows are sorted by operating priority:

1. calling my callsign
2. new DXCC
3. new continent
4. new grid
5. new band/mode for a worked station
6. unworked station
7. worked before
8. latest activity as tie-breaker

The status badges are:

- `Kalder mig`
- `Ny DXCC`
- `Nyt kontinent`
- `Ny grid`
- `Ny band/mode`
- `Ny station`
- `Worked B4`

Roster filters should be simple:

- message type: all, CQ, calling me, 73
- search by callsign/grid/country/message
- only needed
- only with grid

The first implementation should avoid separate wanted and award tabs. Needed and awards become row badges plus the selected-station details.

## Selected Station Panel

Selecting a roster row opens a right-side station panel. It shows:

- primary callsign and latest message
- country, continent, grid, distance, CQ zone, ITU zone, WPX prefix
- recent related messages between my station and the selected station
- current WSJT-X state for that selected callsign
- command actions: call/reply and stop
- logbook status: worked before, waiting for QSO Logged, or linked logged QSO
- compact editable logged QSO form when a matching QSO exists

The panel should keep the existing safety posture:

- no silent transmit enable
- direct actions remain explicit button clicks
- stop action remains visible while commands are available
- unavailable commands are disabled with clear state

The QSO edit form should stay functional but visually compact. It should no longer dominate the page unless a logged QSO exists for the selected station.

## Map Panel

The map uses roster stations, not raw decodes, as markers. This avoids duplicate markers for the same callsign. Marker priority should match roster priority through marker color or label emphasis:

- calling me: highest emphasis
- needed award/grid/band-mode: highlighted
- worked before: muted

Clicking a marker selects the matching roster station and updates the station panel.

## Award Progress Panel

Awards should be compact context, not a separate large work queue. The first version should include:

- counts for live needed DXCC, continents, grids, WPX prefixes, and band/mode slots
- continent status chips
- a small "best live opportunities" list derived from the roster priority model

The award progress panel should not repeat a full table of every decode. The roster is the table.

## Data Model In The Frontend

Introduce a derived frontend model:

```ts
type LiveRosterEntry = {
  callsign: string
  latest: DecodeRow
  decodes: DecodeRow[]
  priorityScore: number
  badges: RosterBadge[]
  logStatus: DecodeLogStatus
  awardReasons: AwardReason[]
  wantedReasons: WantedReason[]
}
```

`DecodeRow` can remain the enriched raw decode model, but page rendering should primarily use `LiveRosterEntry`.

## Code Organization

Split `frontend/src/app/decode/page.tsx` into focused modules:

- `frontend/src/app/decode/page.tsx`: page shell, data loading, high-level state
- `frontend/src/app/decode/decodeFormatters.ts`: time, SNR, band/mode, country, callsign prefix helpers
- `frontend/src/app/decode/decodeScoring.ts`: logbook index, wanted reasons, award reasons, roster grouping, priority scoring
- `frontend/src/app/decode/components/LiveRoster.tsx`
- `frontend/src/app/decode/components/SelectedStationPanel.tsx`
- `frontend/src/app/decode/components/LiveMapPanel.tsx`
- `frontend/src/app/decode/components/AwardProgressPanel.tsx`
- `frontend/src/app/decode/components/RawDecodeDrawer.tsx`

The initial implementation may keep some helper types in `page.tsx` if moving everything at once would create unnecessary risk, but the target is to reduce the page file to orchestration and state.

## Backend Scope

No backend changes are required for the first implementation. Current `/api/wsjtx/decodes`, `/api/wsjtx/stream`, `/api/wsjtx/status`, command endpoints, QSO endpoints, and DXCC fields are sufficient.

## Error Handling

The page should preserve current behavior:

- SSE disconnect shows disconnected state while browser reconnects.
- failed WSJT-X commands show a command status message.
- failed QSO save keeps the form open and reports the error.
- missing grid/country/DXCC data should degrade to `-` or `Ukendt`, not break sorting.

## Testing

Frontend:

- run `npm run lint`
- run `npm run build`
- visually verify `/decode` at desktop and mobile widths if a dev server can be started

Backend:

- run `dotnet test backend/HamHub.Api.Tests/HamHub.Api.Tests.csproj` after any shared DTO or API behavior changes
- backend tests are not required if the implementation only changes frontend presentation

Manual operating checks:

- roster groups multiple decodes from the same callsign
- calling-me rows sort to the top
- needed award rows sort above worked rows
- selecting a roster row updates station panel and map selection
- command buttons still call the existing WSJT-X command API
- logged QSO edit still saves through the existing QSO API

## Out Of Scope

- new award database tables
- LoTW/eQSL award sync changes
- new WSJT-X command types
- automatic transmit behavior
- changing the agent protocol
- replacing Ag Grid globally

## Acceptance Criteria

- `/decode` defaults to the roster/detail/map-award layout.
- The old grid, wanted, and awards tabs are removed or demoted behind a raw/debug affordance.
- The page presents one obvious next-action list for live operation.
- Award and wanted information appears as badges and compact progress context.
- Existing WSJT-X reply/stop and logged-QSO edit workflows still work.
- The code is split enough that roster scoring and UI rendering can be understood separately.
