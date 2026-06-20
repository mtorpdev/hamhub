import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dateTimeLocalUtcToIso, toUtcDateTimeLocal } from './utcDate'

test('formats UTC instants for datetime-local inputs without applying browser timezone', () => {
  assert.equal(toUtcDateTimeLocal('2026-06-20T12:34:56.000Z'), '2026-06-20T12:34')
})

test('parses datetime-local values as UTC wall time', () => {
  assert.equal(dateTimeLocalUtcToIso('2026-06-20T12:34'), '2026-06-20T12:34:00.000Z')
})

test('keeps explicit UTC instants unchanged', () => {
  assert.equal(dateTimeLocalUtcToIso('2026-06-20T12:34:00.000Z'), '2026-06-20T12:34:00.000Z')
})
