import { strict as assert } from 'node:assert'
import test from 'node:test'
import { awardEntityHref } from './awardLinks'

test('builds logbook href when award entity has qso id', () => {
  assert.equal(awardEntityHref({ qsoId: 42 }), '/logbook/42')
})

test('returns null when award entity has no qso id', () => {
  assert.equal(awardEntityHref({ qsoId: null }), null)
})

