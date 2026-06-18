import assert from 'node:assert/strict'
import test from 'node:test'
import { hamhubBrand } from './hamhubBrand'

test('defines HamHub brand colors and wordmark', () => {
  assert.equal(hamhubBrand.name, 'HamHub')
  assert.equal(hamhubBrand.colors.midnight, '#0B1120')
  assert.equal(hamhubBrand.colors.signal, '#38BDF8')
  assert.equal(hamhubBrand.colors.active, '#22C55E')
  assert.ok(hamhubBrand.tagline.includes('radio'))
})
