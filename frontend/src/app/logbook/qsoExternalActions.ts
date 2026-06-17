import type { QsoExternalLogStatus } from '@/lib/types'

export type ExternalPrimaryAction =
  | { kind: 'setup'; label: string; disabled: false }
  | { kind: 'fetch'; label: string; disabled: boolean }
  | { kind: 'send'; label: string; disabled: boolean }

export function externalPrimaryAction(status: QsoExternalLogStatus): ExternalPrimaryAction {
  if (!status.isConfigured) {
    return { kind: 'setup', label: status.fetchActionLabel || status.sendActionLabel, disabled: false }
  }

  if (status.canFetch) {
    return { kind: 'fetch', label: status.fetchActionLabel, disabled: false }
  }

  return { kind: 'send', label: status.sendActionLabel, disabled: !status.canSend }
}

