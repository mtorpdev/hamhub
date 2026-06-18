import test from 'node:test'
import assert from 'node:assert/strict'
import { buildQrzReconciliationSummary } from './qrzReconciliationSummary'
import type { QrzReconciliationResponse } from '@/lib/types'

test('builds qrz reconciliation summary cards', () => {
  const summary = buildQrzReconciliationSummary(response({
    hamHubCount: 295,
    qrzCount: 298,
    inSyncCount: 292,
    timeDriftCount: 1,
    hamHubOnlyCount: 2,
    qrzOnlyCount: 5,
    qrzDuplicateGroupCount: 1,
  }))

  assert.deepEqual(summary.map(item => item.value), ['292', '1', '2', '5', '1'])
})

function response(overrides: Partial<QrzReconciliationResponse>): QrzReconciliationResponse {
  return {
    hamHubCount: 0,
    qrzCount: 0,
    inSyncCount: 0,
    timeDriftCount: 0,
    hamHubOnlyCount: 0,
    qrzOnlyCount: 0,
    qrzDuplicateGroupCount: 0,
    items: [],
    qrzDuplicateGroups: [],
    ...overrides,
  }
}
