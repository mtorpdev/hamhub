import test from 'node:test'
import assert from 'node:assert/strict'
import { forumStatusLabel, normalizeForumTags } from './forumUi'

test('normalizes forum tags for display and submission', () => {
  assert.deepEqual(normalizeForumTags(' POTA, ADIF  #POTA; wsjtx '), ['pota', 'adif', 'wsjtx'])
})

test('labels solved forum threads', () => {
  assert.equal(forumStatusLabel(true), 'Solved')
  assert.equal(forumStatusLabel(false), 'Open')
})
