import test from 'node:test'
import assert from 'node:assert/strict'
import { Band, Mode, type PotaSpot, type Qso } from '@/lib/types'
import { applyPotaSuggestionToForm, findPotaSuggestionForQso } from './potaQsoSuggestion'
import { qsoToEditForm } from './qsoEdit'

function qso(overrides: Partial<Qso> = {}): Qso {
  return {
    id: 1,
    userId: 'user-1',
    dateUtc: '2026-06-18T05:20:00Z',
    ownCallsign: 'OZ4MT',
    workedCallsign: 'K1ABC',
    band: Band.M20,
    frequency: 14.074,
    mode: Mode.FT8,
    rstSent: null,
    rstReceived: null,
    submode: null,
    locator: null,
    myGridsquare: null,
    country: null,
    dxcc: null,
    continent: null,
    state: null,
    cqZone: null,
    ituZone: null,
    county: null,
    myState: null,
    myCounty: null,
    iota: null,
    potaRefs: null,
    sotaRefs: null,
    awardRefs: null,
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
    lotwConfirmedAt: null,
    lotwQslDate: null,
    lotwLastResult: null,
    createdAt: '2026-06-18T05:20:00Z',
    updatedAt: '2026-06-18T05:20:00Z',
    ...overrides,
  }
}

function potaSpot(overrides: Partial<PotaSpot> = {}): PotaSpot {
  return {
    spotId: 100,
    activator: 'K1ABC/P',
    frequency: '14074',
    frequencyKhz: 14074,
    band: '20m',
    mode: 'FT8',
    reference: 'US-0001',
    parkName: 'Acadia',
    locationDesc: 'US-ME',
    grid4: 'FN54',
    grid6: 'FN54vh',
    latitude: 44.31,
    longitude: -68.2,
    spotter: 'N2XYZ',
    comments: 'CQ POTA',
    source: 'GT',
    spotTimeUtc: '2026-06-18T05:18:00Z',
    expiresInSeconds: 1600,
    ...overrides,
  }
}

test('finds POTA suggestion when callsign, band, mode, and time match', () => {
  const suggestion = findPotaSuggestionForQso(qso(), [
    potaSpot({ reference: 'US-0001' }),
    potaSpot({ spotId: 101, reference: 'US-9999', mode: 'CW' }),
  ])

  assert.equal(suggestion?.reference, 'US-0001')
  assert.equal(suggestion?.activator, 'K1ABC/P')
  assert.equal(suggestion?.parkName, 'Acadia')
})

test('does not suggest POTA when qso already has a POTA reference', () => {
  const suggestion = findPotaSuggestionForQso(qso({ potaRefs: 'US-0001' }), [potaSpot()])

  assert.equal(suggestion, null)
})

test('does not suggest stale or wrong-mode POTA spots', () => {
  assert.equal(findPotaSuggestionForQso(qso(), [potaSpot({ spotTimeUtc: '2026-06-18T01:00:00Z' })]), null)
  assert.equal(findPotaSuggestionForQso(qso(), [potaSpot({ mode: 'CW' })]), null)
})

test('applies POTA suggestion to empty edit form without overwriting user data', () => {
  const form = qsoToEditForm(qso())
  const suggestion = findPotaSuggestionForQso(qso(), [potaSpot()])

  const applied = applyPotaSuggestionToForm(form, suggestion)
  const unchanged = applyPotaSuggestionToForm({ ...form, potaRefs: 'US-1234' }, suggestion)

  assert.equal(applied.potaRefs, 'US-0001')
  assert.equal(unchanged.potaRefs, 'US-1234')
})
