import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDuplicateSummary } from './duplicateSummary'
import { Band, Mode, type QsoDuplicateGroup } from '@/lib/types'

test('summarizes duplicate groups for the review UI', () => {
  const summary = buildDuplicateSummary([
    group(1, ['2026-06-18T10:00:00.000Z', '2026-06-18T12:00:20.000Z']),
    group(2, ['2026-06-17T20:00:00.000Z', '2026-06-17T20:00:30.000Z', '2026-06-17T20:00:40.000Z']),
  ])

  assert.deepEqual(summary, {
    groups: 2,
    qsos: 5,
    latestDateUtc: '2026-06-18T12:00:20.000Z',
  })
})

test('summarizes an empty duplicate list', () => {
  assert.deepEqual(buildDuplicateSummary([]), {
    groups: 0,
    qsos: 0,
    latestDateUtc: null,
  })
})

function group(index: number, dates: string[]): QsoDuplicateGroup {
  return {
    key: `group-${index}`,
    workedCallsign: `K${index}ABC`,
    band: '20m',
    mode: 'FT8',
    reason: 'Samme call',
    qsos: dates.map((dateUtc, offset) => ({
      id: index * 10 + offset,
      userId: 'user-1',
      dateUtc,
      ownCallsign: 'OZ1ME',
      workedCallsign: `K${index}ABC`,
      band: Band.M20,
      frequency: 14.074,
      mode: Mode.FT8,
      rstSent: '-10',
      rstReceived: '-08',
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
      createdAt: dateUtc,
      updatedAt: dateUtc,
    })),
  }
}
