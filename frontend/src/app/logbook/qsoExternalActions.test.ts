import { strict as assert } from 'node:assert'
import test from 'node:test'
import type { QsoExternalLogStatus } from '@/lib/types'
import { externalPrimaryAction } from './qsoExternalActions'

function status(overrides: Partial<QsoExternalLogStatus>): QsoExternalLogStatus {
  return {
    provider: 'LoTW',
    status: 'ready',
    label: '',
    externalId: null,
    canSend: false,
    canFetch: true,
    description: '',
    isConfigured: true,
    sendActionLabel: '',
    fetchActionLabel: '',
    lastUpdatedAt: null,
    lastResult: null,
    ...overrides,
  }
}

test('uses fetch action for configured LoTW status', () => {
  const action = externalPrimaryAction(status({ provider: 'LoTW', isConfigured: true, canFetch: true }))

  assert.deepEqual(action, { kind: 'fetch', disabled: false })
})

test('uses send action for ready eQSL status even when status fetch is available', () => {
  const action = externalPrimaryAction(status({
    provider: 'eQSL',
    status: 'ready',
    isConfigured: true,
    canSend: true,
    canFetch: true,
  }))

  assert.deepEqual(action, { kind: 'send', disabled: false })
})

test('uses setup action for unconfigured LoTW status', () => {
  const action = externalPrimaryAction(status({
    provider: 'LoTW',
    status: 'not-configured',
    isConfigured: false,
    canFetch: false,
  }))

  assert.deepEqual(action, { kind: 'setup', disabled: false })
})
