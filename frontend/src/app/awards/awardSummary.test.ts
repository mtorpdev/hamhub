import test from 'node:test'
import assert from 'node:assert/strict'
import { awardEntitySectionLabel, awardStatusLabel, buildAwardGroups, buildAwardWorkflowStats, nextThresholdText } from './awardSummary'
import type { AwardProgress } from '@/lib/types'

test('labels award statuses for the UI', () => {
  assert.equal(awardStatusLabel('active'), 'Aktiv')
  assert.equal(awardStatusLabel('missing-data'), 'Mangler data')
  assert.equal(awardStatusLabel('coming-next'), 'Kommer næste')
})

test('formats next threshold text', () => {
  const award: Pick<AwardProgress, 'workedCount' | 'nextThreshold'> = {
    workedCount: 2,
    nextThreshold: 100,
  }

  assert.equal(nextThresholdText(award), '98 til næste niveau')
  assert.equal(nextThresholdText({ workedCount: 100, nextThreshold: null }), 'Niveau opnået')
})

test('labels award entity sections', () => {
  assert.equal(awardEntitySectionLabel('confirmed'), 'Confirmed entities')
  assert.equal(awardEntitySectionLabel('worked'), 'Worked, needs QSL')
  assert.equal(awardEntitySectionLabel('missing'), 'Missing entities')
})

test('groups awards by sponsor and sorts active awards first', () => {
  const awards = [
    award({ id: 'future', sponsor: 'ARRL', status: 'coming-next', workedCount: 0 }),
    award({ id: 'dxcc', sponsor: 'ARRL', status: 'active', workedCount: 20 }),
    award({ id: 'pota', sponsor: 'POTA', status: 'active', workedCount: 2 }),
  ]

  const groups = buildAwardGroups(awards)

  assert.deepEqual(groups.map(group => group.sponsor), ['ARRL', 'POTA'])
  assert.deepEqual(groups[0].awards.map(item => item.id), ['dxcc', 'future'])
})

test('summarizes award workflow stats', () => {
  const stats = buildAwardWorkflowStats([
    award({ confirmedCount: 7, workedCount: 10, missingCount: 3, unconfirmedEntities: [{ key: '1' }, { key: '2' }] }),
    award({ confirmedCount: 1, workedCount: 1, missingCount: 0, unconfirmedEntities: [] }),
  ])

  assert.deepEqual(stats, {
    worked: 11,
    confirmed: 8,
    needsQsl: 2,
    missing: 3,
  })
})

function award(overrides: Partial<AwardProgress>): AwardProgress {
  return {
    id: 'award',
    sponsor: 'Sponsor',
    name: 'Award',
    description: '',
    status: 'active',
    ruleType: 'dxcc',
    workedCount: 0,
    confirmedCount: 0,
    missingCount: 0,
    nextThreshold: null,
    dataRequirements: [],
    warnings: [],
    entities: [],
    missingEntities: [],
    unconfirmedEntities: [],
    ...overrides,
  }
}
