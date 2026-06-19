import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { detectBrowserLanguage, normalizeLanguage } from './languages'

describe('language helpers', () => {
  it('normalizes supported languages', () => {
    assert.equal(normalizeLanguage(' EN-us '), 'en')
    assert.equal(normalizeLanguage('da-DK'), 'da')
    assert.equal(normalizeLanguage('de-DE'), null)
  })

  it('uses Danish only when the browser explicitly prefers Danish', () => {
    assert.equal(detectBrowserLanguage(['de-DE', 'en-US']), 'en')
    assert.equal(detectBrowserLanguage(['da-DK', 'en-US']), 'da')
    assert.equal(detectBrowserLanguage([]), 'en')
  })
})
