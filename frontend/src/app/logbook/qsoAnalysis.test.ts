import { strict as assert } from 'node:assert'
import test from 'node:test'
import {
  analysisBadgeVariant,
  duplicateRiskLevel,
  duplicateRiskTone,
  flagLabelKey,
  issueSeverityLabelKey,
  issueTone,
  qslStatusLabelKey,
  scoreTone,
  sortIssues,
} from './qsoAnalysis'

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

test('maps duplicate risk score ranges to risk tones', () => {
  assert.equal(duplicateRiskTone(90), 'danger')
  assert.equal(duplicateRiskTone(65), 'warning')
  assert.equal(duplicateRiskTone(30), 'good')
})

test('maps duplicate risk score ranges to risk levels', () => {
  assert.equal(duplicateRiskLevel(90), 'high')
  assert.equal(duplicateRiskLevel(65), 'medium')
  assert.equal(duplicateRiskLevel(30), 'low')
})

test('maps analysis qsl statuses and issue severities to translation keys', () => {
  assert.equal(qslStatusLabelKey('confirmed'), 'logbook.analysis.qslStatus.confirmed')
  assert.equal(qslStatusLabelKey('activity'), 'logbook.analysis.qslStatus.activity')
  assert.equal(qslStatusLabelKey('credential-error'), 'logbook.analysis.qslStatus.credentialError')
  assert.equal(qslStatusLabelKey('missing'), 'logbook.analysis.qslStatus.missing')
  assert.equal(qslStatusLabelKey('none'), 'logbook.analysis.qslStatus.none')
  assert.equal(qslStatusLabelKey('not-configured'), 'logbook.analysis.qslStatus.notConfigured')
  assert.equal(qslStatusLabelKey('ready'), 'logbook.analysis.qslStatus.ready')
  assert.equal(qslStatusLabelKey('sent'), 'logbook.analysis.qslStatus.sent')
  assert.equal(qslStatusLabelKey('logged'), 'logbook.analysis.qslStatus.logged')
  assert.equal(qslStatusLabelKey('synced'), 'logbook.analysis.qslStatus.synced')
  assert.equal(qslStatusLabelKey('custom'), null)
  assert.equal(issueSeverityLabelKey('critical'), 'logbook.analysis.issueSeverity.critical')
  assert.equal(issueSeverityLabelKey('warning'), 'logbook.analysis.issueSeverity.warning')
  assert.equal(issueSeverityLabelKey('info'), 'logbook.analysis.issueSeverity.info')
  assert.equal(issueSeverityLabelKey('other'), null)
})

test('maps analysis flag keys to translation keys', () => {
  assert.equal(flagLabelKey('confirmed'), 'logbook.analysis.flag.confirmed')
  assert.equal(flagLabelKey('missing-data'), 'logbook.analysis.flag.missingData')
  assert.equal(flagLabelKey('duplicate-risk'), 'logbook.analysis.flag.duplicateRisk')
  assert.equal(flagLabelKey('other'), null)
})

test('maps danger analysis tones to a warning badge instead of info', () => {
  assert.equal(analysisBadgeVariant('good'), 'success')
  assert.equal(analysisBadgeVariant('warning'), 'warning')
  assert.equal(analysisBadgeVariant('danger'), 'warning')
  assert.equal(analysisBadgeVariant('default'), 'default')
})
