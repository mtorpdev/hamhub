import { strict as assert } from 'node:assert'
import test from 'node:test'
import { issueTone, scoreTone, sortIssues } from './qsoAnalysis'

test('maps score ranges to tones', () => {
  assert.equal(scoreTone(90), 'good')
  assert.equal(scoreTone(65), 'warning')
  assert.equal(scoreTone(30), 'danger')
})

test('sorts data quality issues by severity', () => {
  const sorted = sortIssues([
    { field: 'txPower', label: 'Power', severity: 'info', description: '' },
    { field: 'locator', label: 'Grid', severity: 'warning', description: '' },
    { field: 'dateUtc', label: 'UTC', severity: 'critical', description: '' },
  ])

  assert.deepEqual(sorted.map(issue => issue.field), ['dateUtc', 'locator', 'txPower'])
})

test('maps issue severity to tones', () => {
  assert.equal(issueTone('critical'), 'danger')
  assert.equal(issueTone('warning'), 'warning')
  assert.equal(issueTone('info'), 'default')
})
