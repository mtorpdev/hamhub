# Live Roster Awards Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/decode` into a GridTracker-like split view with one prioritized live roster, one selected-station panel, and compact map/award context.

**Architecture:** Keep the current API and SSE data flow. Extract decode enrichment, roster grouping, priority scoring, and display helpers from `page.tsx`, then render the page through focused components that consume a `LiveRosterEntry` model.

**Tech Stack:** Next.js 16.2.9 App Router, React 19.2.4, TypeScript, Tailwind CSS 4, AG Grid, Leaflet, .NET 8 backend unchanged.

## Global Constraints

- No backend changes are required for the first implementation.
- Preserve existing WSJT-X reply/stop and logged-QSO edit workflows.
- `/decode` defaults to the roster/detail/map-award layout.
- Old grid/wanted/awards tabs are removed or demoted behind a raw/debug affordance.
- Missing grid/country/DXCC data degrades to `-` or `Ukendt`.
- Follow `frontend/AGENTS.md`: read relevant Next.js docs in `node_modules/next/dist/docs/` before writing frontend code.

---

### Task 1: Extract Decode Scoring And Roster Model

**Files:**
- Create: `frontend/src/app/decode/decodeFormatters.ts`
- Create: `frontend/src/app/decode/decodeScoring.ts`
- Create: `frontend/src/app/decode/decodeScoring.test.ts`
- Modify: `frontend/package.json`

**Interfaces:**
- Produces: `buildLogbookIndex(qsos: Qso[]): LogbookIndex`
- Produces: `enrichDecode(decode: WsjtxDecodeItem, logbook: LogbookIndex, ownCallsign: string): DecodeRow`
- Produces: `buildRosterEntries(rows: DecodeRow[]): LiveRosterEntry[]`
- Produces: `filterRosterEntries(entries: LiveRosterEntry[], filters: RosterFilters): LiveRosterEntry[]`
- Produces: `buildAwardSummary(entries: LiveRosterEntry[], logbook: LogbookIndex): AwardSummary`

- [ ] **Step 1: Add a frontend test script**

Add Node's built-in test runner so pure TypeScript logic can be tested without adding a new dependency:

```json
"test": "node --import tsx --test src/**/*.test.ts"
```

Install `tsx` as a dev dependency if it is not already present:

```powershell
cd D:\hamhub\frontend
npm install -D tsx
```

- [ ] **Step 2: Write failing roster tests**

Create `frontend/src/app/decode/decodeScoring.test.ts` with tests that import the future functions and assert:

```ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildLogbookIndex, buildRosterEntries, enrichDecode, filterRosterEntries } from './decodeScoring'
import { Band, Mode, type Qso, type WsjtxDecodeItem } from '@/lib/types'

function decode(overrides: Partial<WsjtxDecodeItem>): WsjtxDecodeItem {
  return {
    id: overrides.id ?? 1,
    wsjtxId: 'WSJT-X',
    wsjtxTimeMs: 1,
    spotterCallsign: overrides.spotterCallsign ?? 'OZ1ME',
    spotterGrid: overrides.spotterGrid ?? 'JO65',
    message: overrides.message ?? 'CQ DL1ABC JO62',
    dxCallsign: overrides.dxCallsign ?? 'DL1ABC',
    dxGrid: overrides.dxGrid ?? 'JO62',
    snr: overrides.snr ?? -6,
    deltaTime: 0.2,
    deltaFreqHz: 1200,
    frequencyMhz: overrides.frequencyMhz ?? 14.074,
    mode: overrides.mode ?? 'FT8',
    lowConfidence: false,
    isCallable: true,
    dxCountry: overrides.dxCountry ?? 'Fed. Rep. of Germany',
    dxContinent: overrides.dxContinent ?? 'EU',
    dxPrimaryPrefix: overrides.dxPrimaryPrefix ?? 'DL',
    dxMatchedPrefix: overrides.dxMatchedPrefix ?? 'DL',
    dxWpxPrefix: overrides.dxWpxPrefix ?? 'DL1',
    dxCqZone: 14,
    dxItuZone: 28,
    dxLatitude: 51,
    dxLongitude: 10,
    dxUtcOffset: 1,
    decodedAt: overrides.decodedAt ?? '2026-06-17T10:00:00Z',
  }
}

function qso(overrides: Partial<Qso>): Qso {
  return {
    id: overrides.id ?? 1,
    userId: 'user-1',
    dateUtc: '2026-06-16T10:00:00Z',
    ownCallsign: 'OZ1ME',
    workedCallsign: overrides.workedCallsign ?? 'SM1OLD',
    band: overrides.band ?? Band.M20,
    frequency: 14.074,
    mode: overrides.mode ?? Mode.FT8,
    rstSent: null,
    rstReceived: null,
    submode: null,
    locator: overrides.locator ?? 'JO89',
    myGridsquare: 'JO65',
    country: overrides.country ?? 'Sweden',
    dxcc: null,
    continent: overrides.continent ?? 'EU',
    state: null,
    iota: null,
    name: null,
    qth: null,
    txPower: null,
    comment: null,
    qrzId: null,
    qrzConfirmationStatus: null,
    qrzConfirmedAt: null,
    qrzQslDate: null,
    eqslSentAt: null,
    eqslConfirmedAt: null,
    eqslLastResult: null,
    createdAt: '2026-06-16T10:00:00Z',
    updatedAt: '2026-06-16T10:00:00Z',
  }
}

test('groups multiple decodes into one roster entry per callsign using the latest decode', () => {
  const logbook = buildLogbookIndex([])
  const rows = [
    enrichDecode(decode({ id: 1, decodedAt: '2026-06-17T10:00:00Z', snr: -12 }), logbook, 'OZ1ME'),
    enrichDecode(decode({ id: 2, decodedAt: '2026-06-17T10:01:00Z', snr: 3 }), logbook, 'OZ1ME'),
  ]

  const roster = buildRosterEntries(rows)

  assert.equal(roster.length, 1)
  assert.equal(roster[0].callsign, 'DL1ABC')
  assert.equal(roster[0].latest.id, 2)
  assert.equal(roster[0].decodes.length, 2)
})

test('sorts calling-me and needed stations above worked stations', () => {
  const logbook = buildLogbookIndex([
    qso({ workedCallsign: 'SM1OLD', country: 'Sweden', locator: 'JO89' }),
  ])
  const rows = [
    enrichDecode(decode({ id: 1, message: 'CQ SM1OLD JO89', dxCallsign: 'SM1OLD', dxCountry: 'Sweden', dxGrid: 'JO89' }), logbook, 'OZ1ME'),
    enrichDecode(decode({ id: 2, message: 'DL1NEW OZ1ME -10', dxCallsign: 'DL1NEW', dxCountry: 'Fed. Rep. of Germany', dxGrid: 'JO62' }), logbook, 'OZ1ME'),
    enrichDecode(decode({ id: 3, message: 'CQ EA1NEW IN53', dxCallsign: 'EA1NEW', dxCountry: 'Spain', dxContinent: 'EU', dxGrid: 'IN53' }), logbook, 'OZ1ME'),
  ]

  const roster = buildRosterEntries(rows)

  assert.deepEqual(roster.map(entry => entry.callsign), ['DL1NEW', 'EA1NEW', 'SM1OLD'])
  assert.ok(roster[0].badges.some(badge => badge.key === 'calling-me'))
  assert.ok(roster[1].badges.some(badge => badge.key === 'dxcc'))
  assert.ok(roster[2].badges.some(badge => badge.key === 'worked'))
})

test('filters roster to only needed entries', () => {
  const logbook = buildLogbookIndex([qso({ workedCallsign: 'SM1OLD', country: 'Sweden', locator: 'JO89' })])
  const roster = buildRosterEntries([
    enrichDecode(decode({ id: 1, dxCallsign: 'SM1OLD', dxCountry: 'Sweden', dxGrid: 'JO89' }), logbook, 'OZ1ME'),
    enrichDecode(decode({ id: 2, dxCallsign: 'EA1NEW', dxCountry: 'Spain', dxGrid: 'IN53' }), logbook, 'OZ1ME'),
  ])

  const filtered = filterRosterEntries(roster, { messageFilter: 'all', search: '', onlyNeeded: true, onlyWithGrid: false })

  assert.deepEqual(filtered.map(entry => entry.callsign), ['EA1NEW'])
})
```

- [ ] **Step 3: Run tests to verify RED**

Run:

```powershell
cd D:\hamhub\frontend
npm test -- src/app/decode/decodeScoring.test.ts
```

Expected: FAIL because `decodeScoring` does not exist.

- [ ] **Step 4: Implement scoring and formatters**

Move pure helper logic from `page.tsx` into `decodeFormatters.ts` and `decodeScoring.ts`. Include type exports for `DecodeRow`, `LiveRosterEntry`, `RosterBadge`, `AwardSummary`, `RosterFilters`, `DecodeLogStatus`, `WantedReason`, and `AwardReason`.

- [ ] **Step 5: Run tests to verify GREEN**

Run:

```powershell
cd D:\hamhub\frontend
npm test -- src/app/decode/decodeScoring.test.ts
```

Expected: PASS.

---

### Task 2: Build Focused Decode Page Components

**Files:**
- Create: `frontend/src/app/decode/components/LiveRoster.tsx`
- Create: `frontend/src/app/decode/components/SelectedStationPanel.tsx`
- Create: `frontend/src/app/decode/components/LiveMapPanel.tsx`
- Create: `frontend/src/app/decode/components/AwardProgressPanel.tsx`
- Create: `frontend/src/app/decode/components/RawDecodeDrawer.tsx`

**Interfaces:**
- Consumes: `LiveRosterEntry`, `DecodeRow`, `AwardSummary`, `RosterFilters`
- Produces: presentation components with callbacks for selection, command, stop, QSO edit/save, filters, and raw drawer toggle.

- [ ] **Step 1: Create `LiveRoster`**

Render one button row per `LiveRosterEntry`, with stable dimensions and badges. Props:

```ts
type LiveRosterProps = {
  entries: LiveRosterEntry[]
  selectedCallsign: string
  filters: RosterFilters
  connected: boolean
  onFiltersChange: (filters: RosterFilters) => void
  onSelect: (entry: LiveRosterEntry) => void
  onOpenRaw: () => void
}
```

- [ ] **Step 2: Create `SelectedStationPanel`**

Move selected decode details, related trail, command buttons, WSJT-X status text, TX count, command status, and QSO edit form from `page.tsx` into this component. Keep existing labels and API-triggering callbacks in the page shell.

- [ ] **Step 3: Create `LiveMapPanel`**

Wrap `LeafletMap`, derive markers from roster entries, and call `onSelectCallsign(callsign)` on marker click.

- [ ] **Step 4: Create `AwardProgressPanel`**

Render compact counters, continent chips, and top live opportunities from roster entries. Do not render a full decode table.

- [ ] **Step 5: Create `RawDecodeDrawer`**

Render the old AG Grid table behind a button/drawer. Keep it available for debugging, but not as the default page workflow.

---

### Task 3: Wire The New Page Shell

**Files:**
- Modify: `frontend/src/app/decode/page.tsx`

**Interfaces:**
- Consumes: all Task 1 helpers and Task 2 components.
- Produces: `/decode` split layout as default.

- [ ] **Step 1: Read Next.js local docs before editing**

Run:

```powershell
Get-ChildItem D:\hamhub\frontend\node_modules\next\dist\docs -Recurse -Filter "*app*.md" | Select-Object -First 5
```

Read the relevant App Router/client component docs available locally before modifying `page.tsx`.

- [ ] **Step 2: Replace tab state with roster state**

Remove `activeView`, `awardFilters`, `onlyAwardNeeded`, `quickSearch`, and `onlyWithGrid` as separate page concerns. Replace with:

```ts
const [rosterFilters, setRosterFilters] = useState<RosterFilters>({
  messageFilter: 'all',
  search: '',
  onlyNeeded: false,
  onlyWithGrid: false,
})
const [rawOpen, setRawOpen] = useState(false)
```

- [ ] **Step 3: Derive rows, roster, filtered roster, selected entry, and award summary**

Use Task 1 functions:

```ts
const rows = useMemo(() => decodes.map(d => enrichDecode(d, logbook, ownCallsign)), [decodes, logbook, ownCallsign])
const roster = useMemo(() => buildRosterEntries(rows), [rows])
const filteredRoster = useMemo(() => filterRosterEntries(roster, rosterFilters), [roster, rosterFilters])
const selectedEntry = useMemo(() => roster.find(entry => entry.callsign === selectedCallsign) ?? filteredRoster[0] ?? null, [roster, filteredRoster, selectedCallsign])
const awardSummary = useMemo(() => buildAwardSummary(roster, logbook), [roster, logbook])
```

- [ ] **Step 4: Preserve WSJT-X/QSO workflows**

Keep `handleCallDecode`, `handleStopTx`, `handleSaveLoggedQso`, selected QSO lookup, TX counting, status polling, and SSE handling. Pass them into `SelectedStationPanel`.

- [ ] **Step 5: Replace JSX with split layout**

Render:

```tsx
<div className="grid gap-4 xl:grid-cols-[minmax(420px,0.95fr)_minmax(520px,1.05fr)]">
  <LiveRoster ... />
  <div className="space-y-4">
    <SelectedStationPanel ... />
    <div className="grid gap-4 lg:grid-cols-2">
      <LiveMapPanel ... />
      <AwardProgressPanel ... />
    </div>
  </div>
</div>
<RawDecodeDrawer ... />
```

---

### Task 4: Verify, Fix, And Commit

**Files:**
- Modify as needed based on compiler/lint feedback.

- [ ] **Step 1: Run frontend tests**

Run:

```powershell
cd D:\hamhub\frontend
npm test -- src/app/decode/decodeScoring.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run lint**

Run:

```powershell
cd D:\hamhub\frontend
npm run lint
```

Expected: exit 0.

- [ ] **Step 3: Run build**

Run:

```powershell
cd D:\hamhub\frontend
npm run build
```

Expected: exit 0.

- [ ] **Step 4: Run backend tests if shared types/API were changed**

Run only if backend or shared API contracts were modified:

```powershell
dotnet test D:\hamhub\backend\HamHub.Api.Tests\HamHub.Api.Tests.csproj
```

Expected: 0 failed.

- [ ] **Step 5: Commit implementation**

Run:

```powershell
git add frontend/src/app/decode frontend/package.json frontend/package-lock.json
git commit -m "feat: redesign live decode roster"
```

