import test from 'node:test'
import assert from 'node:assert/strict'
import { awardEntitySectionLabel, awardStatusLabel, nextThresholdText } from './awardSummary'
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
