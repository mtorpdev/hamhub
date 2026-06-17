# Live Roster Award Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add worked-versus-confirmed and DXCC band/mode intelligence to the existing `/decode` Live Roster without changing the local agent.

**Architecture:** Keep the current frontend-derived scoring model in `decodeScoring.ts`. Extend `LogbookIndex`, `DecodeRow`, `LiveRosterEntry`, filters, badges, and award summary; then render the new fields in `LiveRoster` and `AwardProgressPanel`.

**Tech Stack:** Next.js 16.2.9 App Router, React 19.2.4, TypeScript, Node test runner, Tailwind CSS 4.

## Global Constraints

- Do not add local agent or TQSL behavior.
- Do not add backend award tables in this phase.
- Use existing QSO confirmation fields: `lotwConfirmedAt`, `eqslConfirmedAt`, `qrzConfirmedAt`, and QRZ status `C`.
- Keep existing WSJT-X reply/stop, raw decode drawer, map selection, and QSO edit workflows.
- Write failing tests before production code.

---

### Task 1: Extend Scoring Tests

**Files:**
- Modify: `frontend/src/app/decode/decodeScoring.test.ts`

**Interfaces:**
- Consumes: `buildLogbookIndex`, `enrichDecode`, `buildRosterEntries`, `filterRosterEntries`, `buildAwardSummary`
- Produces: tests for new confirmed and DXCC slot behavior.

- [ ] Add tests for confirmed badge, Need QSL, DXCC need QSL, New band, New mode, Unconfirmed filter, and worked/confirmed country counts.
- [ ] Run `npm.cmd test -- src/app/decode/decodeScoring.test.ts`.
- [ ] Confirm RED: tests fail because the current model has no confirmed/unconfirmed/DXCC-slot fields.

### Task 2: Extend Decode Scoring Model

**Files:**
- Modify: `frontend/src/app/decode/decodeScoring.ts`

**Interfaces:**
- Produces: `confirmedCallsigns`, `confirmedCountries`, `workedCountryBands`, `confirmedCountryBands`, `workedCountryModes`, `confirmedCountryModes`
- Produces: row fields `isWorked`, `isConfirmed`, `needsConfirmation`, `isDxccNeeded`, `needsDxccConfirmation`, `isNewDxccBand`, `isNewDxccMode`
- Produces: badge keys `need-qsl`, `confirmed`, `dxcc-qsl`, `dxcc-band`, `dxcc-mode`

- [ ] Implement `isQsoConfirmed(qso: Qso): boolean`.
- [ ] Extend `buildLogbookIndex`.
- [ ] Extend `enrichDecode` and roster aggregation.
- [ ] Update priority scoring and `isNeededEntry`.
- [ ] Run scoring tests and confirm GREEN.

### Task 3: Render New Filters And Award Counts

**Files:**
- Modify: `frontend/src/app/decode/components/LiveRoster.tsx`
- Modify: `frontend/src/app/decode/components/AwardProgressPanel.tsx`
- Modify: `frontend/src/app/decode/page.tsx`

**Interfaces:**
- Consumes: extended `RosterFilters` with `onlyUnconfirmed`
- Consumes: extended `AwardSummary` counts

- [ ] Add `Unconfirmed` checkbox to Live Roster filters.
- [ ] Update `DEFAULT_ROSTER_FILTERS` with `onlyUnconfirmed: false`.
- [ ] Show worked and confirmed country counts in Award panel.
- [ ] Run eslint and build.

### Task 4: Verify And Commit

**Files:**
- All modified files from tasks 1-3.

- [ ] Run `npm.cmd test -- src/app/decode/decodeScoring.test.ts`.
- [ ] Run `npx.cmd eslint src/app/decode`.
- [ ] Run `npm.cmd run build`.
- [ ] Commit with `feat: add live roster award intelligence`.
- [ ] Push and watch production deploy.
