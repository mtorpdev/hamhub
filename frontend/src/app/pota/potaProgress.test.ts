import test from 'node:test'
import assert from 'node:assert/strict'
import { Band, Mode, type PotaSpot, type Qso } from '@/lib/types'
import { buildPotaProgress, potaSpotStatus } from './potaProgress'

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

function spot(overrides: Partial<PotaSpot> = {}): PotaSpot {
  return {
    spotId: 1,
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

test('builds POTA worked and confirmed progress from logbook refs', () => {
  const progress = buildPotaProgress([
    qso({ id: 1, potaRefs: 'US-0001, US-0002', lotwConfirmedAt: '2026-06-18T06:00:00Z' }),
    qso({ id: 2, potaRefs: 'DK-0001', qrzId: '123' }),
    qso({ id: 3, potaRefs: 'DK-0001', eqslConfirmedAt: '2026-06-18T06:30:00Z' }),
  ])

  assert.equal(progress.workedCount, 3)
  assert.equal(progress.confirmedCount, 3)
  assert.equal(progress.needQslCount, 0)
  assert.equal(progress.refs.get('US-0001')?.status, 'confirmed')
  assert.equal(progress.refs.get('DK-0001')?.qsoCount, 2)
})

test('marks live POTA spots as new, worked, need-qsl, or confirmed', () => {
  const progress = buildPotaProgress([
    qso({ potaRefs: 'US-0001', lotwConfirmedAt: '2026-06-18T06:00:00Z' }),
    qso({ id: 2, potaRefs: 'US-0002' }),
  ])

  assert.equal(potaSpotStatus(spot({ reference: 'US-0001' }), progress), 'confirmed')
  assert.equal(potaSpotStatus(spot({ reference: 'US-0002' }), progress), 'need-qsl')
  assert.equal(potaSpotStatus(spot({ reference: 'US-0003' }), progress), 'new')
})
