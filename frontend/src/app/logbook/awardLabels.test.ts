import { strict as assert } from 'node:assert'
import test from 'node:test'
import { Band, Mode, type Qso } from '@/lib/types'
import { buildQsoAwardLabels } from './awardLabels'

function qso(overrides: Partial<Qso>): Qso {
  return {
    id: 1,
    userId: 'user-1',
    dateUtc: '2026-06-17T10:00:00Z',
    ownCallsign: 'OZ1ME',
    workedCallsign: 'DL1ABC',
    band: Band.M20,
    frequency: null,
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
    createdAt: '2026-06-17T10:00:00Z',
    updatedAt: '2026-06-17T10:00:00Z',
    ...overrides,
  }
}

test('builds compact award labels for qso list', () => {
  const labels = buildQsoAwardLabels(qso({
    dxcc: 230,
    cqZone: 14,
    ituZone: 28,
    iota: 'EU-029',
    potaRefs: 'OZ-0001, OZ-0002',
    sotaRefs: 'OZ/OZ-001',
    county: 'DK-AR',
  }))

  assert.deepEqual(labels.map(label => label.text), [
    'DXCC 230',
    'CQ 14',
    'ITU 28',
    'IOTA EU-029',
    'POTA 2',
    'SOTA OZ/OZ-001',
    'CNTY DK-AR',
  ])
})

test('omits empty award labels', () => {
  assert.deepEqual(buildQsoAwardLabels(qso({})), [])
})

