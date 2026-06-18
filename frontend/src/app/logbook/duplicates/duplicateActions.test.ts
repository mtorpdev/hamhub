import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMergeDuplicatePayload } from './duplicateActions'

test('builds merge payload by keeping the selected qso and merging the rest', () => {
  assert.deepEqual(buildMergeDuplicatePayload([10, 11, 12], 11), {
    keepId: 11,
    duplicateIds: [10, 12],
  })
})
