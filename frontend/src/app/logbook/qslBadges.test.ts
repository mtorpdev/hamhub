import test from 'node:test'
import assert from 'node:assert/strict'
import { eqslTitle, eqslTone, lotwTitle, lotwTone } from './qslBadges'
import { Band, Mode, type Qso } from '@/lib/types'

function qso(overrides: Partial<Qso> = {}): Qso {
  return {
    id: 1,
    userId: 'user-1',
    dateUtc: '2026-06-16T10:00:00Z',
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
    createdAt: '2026-06-16T10:00:00Z',
    updatedAt: '2026-06-16T10:00:00Z',
    ...overrides,
  }
}

const daLotwLabels = {
  confirmed: 'LoTW bekræftet af modparten',
  pending: 'LoTW er klar eller ikke tjekket endnu',
  checkedUnconfirmed: 'LoTW tjekket, men QSO er ikke bekræftet endnu',
  verifyFailed: 'LoTW status kunne ikke verificeres',
  ready: 'LoTW er klar eller ikke tjekket endnu',
}

test('marks LoTW as confirmed when a confirmation date exists', () => {
  assert.equal(lotwTone(qso({ lotwConfirmedAt: '2026-06-17T08:10:11Z' })), 'confirmed')
  assert.equal(lotwTitle(qso({ lotwConfirmedAt: '2026-06-17T08:10:11Z' })), 'LoTW confirmed by the other station')
  assert.equal(lotwTitle(qso({ lotwConfirmedAt: '2026-06-17T08:10:11Z' }), daLotwLabels), 'LoTW bekræftet af modparten')
})

test('marks LoTW as missing when it was checked but not confirmed', () => {
  const checked = qso({ lotwLastResult: 'LoTW status opdateret: ikke fundet' })

  assert.equal(lotwTone(checked), 'missing')
  assert.equal(lotwTitle(checked), 'LoTW checked, but QSO is not confirmed yet')
})

test('marks LoTW as pending before status has been checked', () => {
  const unchecked = qso()

  assert.equal(lotwTone(unchecked), 'pending')
  assert.equal(lotwTitle(unchecked), 'LoTW is ready or has not been checked yet')
})

test('keeps eQSL not-found checks pending so unconfirmed matches are not shown as errors', () => {
  const checked = qso({ eqslLastResult: 'eQSL status opdateret: QSO ikke fundet på eQSL endnu. QSO ikke fundet på eQSL endnu.' })

  assert.equal(eqslTone(checked), 'pending')
  assert.equal(eqslTitle(checked), 'eQSL checked, but QSO is not confirmed yet')
})
