import { strict as assert } from 'node:assert'
import test from 'node:test'
import type { QsoExternalLogStatus } from '@/lib/types'
import { externalPrimaryAction } from './qsoExternalActions'

function status(overrides: Partial<QsoExternalLogStatus>): QsoExternalLogStatus {
  return {
    provider: 'LoTW',
    status: 'ready',
    label: 'Klar til LoTW sync',
    externalId: null,
    canSend: false,
    canFetch: true,
    description: '',
    isConfigured: true,
    sendActionLabel: 'Kræver TQSL',
    fetchActionLabel: 'Hent LoTW',
    lastUpdatedAt: null,
    lastResult: null,
    ...overrides,
  }
}

test('uses fetch action for configured LoTW status', () => {
  const action = externalPrimaryAction(status({ provider: 'LoTW', isConfigured: true, canFetch: true }))

  assert.deepEqual(action, { kind: 'fetch', label: 'Hent LoTW', disabled: false })
})

test('uses setup action for unconfigured LoTW status', () => {
  const action = externalPrimaryAction(status({
    provider: 'LoTW',
    status: 'not-configured',
    isConfigured: false,
    canFetch: false,
    fetchActionLabel: 'Opsæt LoTW',
  }))

  assert.deepEqual(action, { kind: 'setup', label: 'Opsæt LoTW', disabled: false })
})

