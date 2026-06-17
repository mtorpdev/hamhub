import test from 'node:test'
import assert from 'node:assert/strict'
import { nextLoggedQsoPopupId } from './loggedQsoPopup'
import { Band, Mode, type Qso } from '@/lib/types'

function qso(overrides: Partial<Qso> = {}): Qso {
  return {
    id: 1,
    userId: 'user-1',
    dateUtc: '2026-06-17T10:00:00Z',
    ownCallsign: 'OZ1ME',
    workedCallsign: 'DL1ABC',
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
    lotwConfirmedAt: null,
    lotwQslDate: null,
    lotwLastResult: null,
    createdAt: '2026-06-17T10:00:00Z',
    updatedAt: '2026-06-17T10:00:00Z',
    ...overrides,
  }
}

test('opens popup for a QSO that appears after the previous logbook snapshot', () => {
  const previous = [qso({ id: 1 })]
  const current = [qso({ id: 2 }), qso({ id: 1 })]

  assert.equal(nextLoggedQsoPopupId(previous, current, new Set()), 2)
})

test('does not reopen a dismissed logged QSO', () => {
  const previous = [qso({ id: 1 })]
  const current = [qso({ id: 2 }), qso({ id: 1 })]

  assert.equal(nextLoggedQsoPopupId(previous, current, new Set([2])), null)
})

test('does not open a popup on the initial logbook load', () => {
  assert.equal(nextLoggedQsoPopupId(null, [qso({ id: 1 })], new Set()), null)
})

test('opens popup when the logbook was initially empty and a new QSO arrives later', () => {
  assert.equal(nextLoggedQsoPopupId([], [qso({ id: 1 })], new Set()), 1)
})
