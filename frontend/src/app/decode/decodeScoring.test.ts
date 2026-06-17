import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAwardSummary, buildLogbookIndex, buildRosterEntries, enrichDecode, filterRosterEntries } from './decodeScoring'
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
    serverReceivedAtUtc: overrides.serverReceivedAtUtc ?? '2026-06-17T10:00:01Z',
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
    eqslConfirmedAt: overrides.eqslConfirmedAt ?? null,
    eqslLastResult: null,
    lotwConfirmedAt: overrides.lotwConfirmedAt ?? null,
    lotwQslDate: overrides.lotwQslDate ?? null,
    lotwLastResult: overrides.lotwLastResult ?? null,
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
  const logbook = buildLogbookIndex([qso({ workedCallsign: 'SM1OLD', country: 'Sweden', locator: 'JO89', lotwConfirmedAt: '2026-06-17T08:10:11Z' })])
  const roster = buildRosterEntries([
    enrichDecode(decode({ id: 1, dxCallsign: 'SM1OLD', dxCountry: 'Sweden', dxGrid: 'JO89' }), logbook, 'OZ1ME'),
    enrichDecode(decode({ id: 2, dxCallsign: 'EA1NEW', dxCountry: 'Spain', dxGrid: 'IN53' }), logbook, 'OZ1ME'),
  ])

  const filtered = filterRosterEntries(roster, { messageFilter: 'all', search: '', onlyNeeded: true, onlyWithGrid: false, onlyUnconfirmed: false })

  assert.deepEqual(filtered.map(entry => entry.callsign), ['EA1NEW'])
})

test('adds LoTW badge when callsign has recent LoTW activity', () => {
  const logbook = buildLogbookIndex([])
  const rows = [
    enrichDecode(decode({ id: 1, dxCallsign: 'K1LOTW', dxCountry: 'United States', dxGrid: 'FN42' }), logbook, 'OZ1ME'),
  ]

  const roster = buildRosterEntries(rows, { K1LOTW: '2026-06-15' })

  assert.ok(roster[0].badges.some(badge => badge.key === 'lotw' && badge.label === 'LoTW'))
})

test('marks worked confirmed stations separately from stations needing QSL', () => {
  const logbook = buildLogbookIndex([
    qso({ workedCallsign: 'SM1CFM', country: 'Sweden', locator: 'JO89', lotwConfirmedAt: '2026-06-17T08:10:11Z' }),
    qso({ workedCallsign: 'SM1QSL', country: 'Sweden', locator: 'JO99' }),
  ])
  const roster = buildRosterEntries([
    enrichDecode(decode({ id: 1, dxCallsign: 'SM1CFM', dxCountry: 'Sweden', dxGrid: 'JO89' }), logbook, 'OZ1ME'),
    enrichDecode(decode({ id: 2, dxCallsign: 'SM1QSL', dxCountry: 'Sweden', dxGrid: 'JO99' }), logbook, 'OZ1ME'),
  ])

  const confirmed = roster.find(entry => entry.callsign === 'SM1CFM')
  const needQsl = roster.find(entry => entry.callsign === 'SM1QSL')

  assert.ok(confirmed?.badges.some(badge => badge.key === 'confirmed' && badge.label === 'Confirmed'))
  assert.equal(confirmed?.latest.needsConfirmation, false)
  assert.ok(!confirmed?.badges.some(badge => badge.key === 'need-qsl'))
  assert.ok(needQsl?.badges.some(badge => badge.key === 'need-qsl' && badge.label === 'Need QSL'))
  assert.equal(needQsl?.latest.needsConfirmation, true)
})

test('filters roster to only unconfirmed worked stations', () => {
  const logbook = buildLogbookIndex([
    qso({ workedCallsign: 'SM1CFM', country: 'Sweden', lotwConfirmedAt: '2026-06-17T08:10:11Z' }),
    qso({ workedCallsign: 'SM1QSL', country: 'Sweden' }),
  ])
  const roster = buildRosterEntries([
    enrichDecode(decode({ id: 1, dxCallsign: 'SM1CFM', dxCountry: 'Sweden' }), logbook, 'OZ1ME'),
    enrichDecode(decode({ id: 2, dxCallsign: 'SM1QSL', dxCountry: 'Sweden' }), logbook, 'OZ1ME'),
    enrichDecode(decode({ id: 3, dxCallsign: 'EA1NEW', dxCountry: 'Spain' }), logbook, 'OZ1ME'),
  ])

  const filtered = filterRosterEntries(roster, { messageFilter: 'all', search: '', onlyNeeded: false, onlyWithGrid: false, onlyUnconfirmed: true })

  assert.deepEqual(filtered.map(entry => entry.callsign), ['SM1QSL'])
})

test('marks worked but unconfirmed DXCC as DXCC need QSL', () => {
  const logbook = buildLogbookIndex([
    qso({ workedCallsign: 'SM1OLD', country: 'Sweden' }),
  ])
  const roster = buildRosterEntries([
    enrichDecode(decode({ id: 1, dxCallsign: 'SM2LIVE', dxCountry: 'Sweden' }), logbook, 'OZ1ME'),
  ])

  assert.ok(roster[0].badges.some(badge => badge.key === 'dxcc-qsl' && badge.label === 'DXCC need QSL'))
  assert.equal(roster[0].latest.needsDxccConfirmation, true)
})

test('marks worked DXCC on new band and new mode slots', () => {
  const logbook = buildLogbookIndex([
    qso({ workedCallsign: 'SM1OLD', country: 'Sweden', band: Band.M20, mode: Mode.FT8, lotwConfirmedAt: '2026-06-17T08:10:11Z' }),
  ])
  const roster = buildRosterEntries([
    enrichDecode(decode({ id: 1, dxCallsign: 'SM2BAND', dxCountry: 'Sweden', frequencyMhz: 7.074, mode: 'FT4' }), logbook, 'OZ1ME'),
  ])

  assert.ok(roster[0].badges.some(badge => badge.key === 'dxcc-band' && badge.label === 'New band'))
  assert.ok(roster[0].badges.some(badge => badge.key === 'dxcc-mode' && badge.label === 'New mode'))
  assert.equal(roster[0].latest.isNewDxccBand, true)
  assert.equal(roster[0].latest.isNewDxccMode, true)
})

test('award summary counts worked and confirmed countries separately', () => {
  const logbook = buildLogbookIndex([
    qso({ workedCallsign: 'SM1OLD', country: 'Sweden' }),
    qso({ workedCallsign: 'DL1OLD', country: 'Fed. Rep. of Germany', lotwConfirmedAt: '2026-06-17T08:10:11Z' }),
  ])
  const roster = buildRosterEntries([
    enrichDecode(decode({ id: 1, dxCallsign: 'SM2LIVE', dxCountry: 'Sweden' }), logbook, 'OZ1ME'),
  ])

  const summary = buildAwardSummary(roster, logbook)

  assert.equal(summary.workedCountries, 2)
  assert.equal(summary.confirmedCountries, 1)
  assert.equal(summary.liveDxccNeedQsl, 1)
})
