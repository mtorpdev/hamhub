# Live Roster Award Intelligence

## Goal

Upgrade the existing `/decode` Live Roster so it understands worked versus confirmed status and highlights practical DXCC/band/mode opportunities without touching the local agent or LoTW upload flow.

## Scope

This is a frontend-derived intelligence layer built from the authenticated user's existing QSO log and the current live WSJT-X decodes. No new agent behavior, no TQSL integration, and no LoTW upload is included.

## Behavior

The roster should distinguish:

- stations never worked before
- stations worked before but not confirmed by QRZ, eQSL, or LoTW
- stations confirmed before
- new DXCC entities
- worked DXCC entities that are not confirmed yet
- new DXCC band slots
- new DXCC mode slots
- LoTW-active stations from the existing LoTW activity lookup

Confirmed status is true when a QSO has any of:

- `lotwConfirmedAt`
- `eqslConfirmedAt`
- `qrzConfirmedAt`
- `qrzConfirmationStatus` equal to `C`

The first implementation should use country name as the DXCC key because the current live decode and logbook types already expose country fields. Numeric DXCC can replace the country key in a separate backend-backed award model.

## UI

Live Roster badges should become more explicit:

- `New DXCC`
- `DXCC need QSL`
- `New band`
- `New mode`
- `Need QSL`
- `Confirmed`
- `Worked B4`
- `LoTW active`

Filters should stay compact and add one new checkbox:

- `Unconfirmed`

`Needed` should include new DXCC, unconfirmed DXCC, new band/mode, new grid, new WPX, and unworked stations. A station that is only `Worked B4` and already confirmed is not needed.

## Award Panel

The award panel should show separate worked, confirmed, and live-needed counts for DXCC-oriented progress:

- worked countries
- confirmed countries
- live new DXCC
- live DXCC needing QSL
- live new band/mode slots

The "best live opportunities" list should continue to come from roster priority.

## Testing

Add tests in `frontend/src/app/decode/decodeScoring.test.ts` for:

- confirmed QSO creates a confirmed badge instead of Need QSL
- worked but unconfirmed QSO creates Need QSL and passes the Unconfirmed filter
- worked country without confirmed country creates DXCC need QSL
- worked country on a new band and new mode creates New band and New mode badges

Run:

- `npm.cmd test -- src/app/decode/decodeScoring.test.ts`
- `npx.cmd eslint src/app/decode`
- `npm.cmd run build`

## Acceptance Criteria

- Live Roster visibly separates confirmed from merely worked stations.
- Needed filtering still includes true award opportunities and excludes confirmed worked-only stations.
- A new Unconfirmed filter returns stations/QSOs needing confirmation.
- Award panel counts worked and confirmed countries separately.
- Existing call/reply, stop, raw decode drawer, map selection, and QSO edit flows remain unchanged.
