import type { QsoExternalLogStatus } from '@/lib/types'
import type { TranslationKey } from '@/i18n/translations'

export type ExternalPrimaryAction =
  | { kind: 'setup'; disabled: false }
  | { kind: 'fetch'; disabled: boolean }
  | { kind: 'send'; disabled: boolean }

type T = (key: TranslationKey, values?: Record<string, string | number | null | undefined>) => string

export function externalPrimaryAction(status: QsoExternalLogStatus): ExternalPrimaryAction {
  if (!status.isConfigured) {
    return { kind: 'setup', disabled: false }
  }

  if (status.canFetch) {
    return { kind: 'fetch', disabled: false }
  }

  return { kind: 'send', disabled: !status.canSend }
}

export function externalActionLabel(status: QsoExternalLogStatus, action: ExternalPrimaryAction, t: T) {
  if (action.kind === 'setup') return t(providerKey(status.provider, 'setup'))
  if (action.kind === 'fetch') return t(providerKey(status.provider, 'fetch'))
  return t(providerKey(status.provider, 'send'))
}

export function externalStatusLabel(status: QsoExternalLogStatus, t: T) {
  return t(providerStatusKey(status.provider, status.status, 'label'))
}

export function externalStatusDescription(status: QsoExternalLogStatus, t: T) {
  return t(providerStatusKey(status.provider, status.status, 'description'))
}

export function externalLastResult(status: QsoExternalLogStatus, t: T) {
  if (!status.lastResult) return null
  const result = status.lastResult.toLowerCase()
  if (result.startsWith('eqsl status opdateret:') || result.startsWith('lotw status opdateret:')) {
    return t('logbook.detail.externalResult.checked', { provider: status.provider })
  }
  if (result.startsWith('kunne ikke opdatere eqsl status:') || result.startsWith('kunne ikke opdatere lotw status:')) {
    return t('logbook.detail.externalResult.failed', { provider: status.provider })
  }
  if (status.provider.toLowerCase() === 'qrz') {
    return t(providerStatusKey(status.provider, status.status, 'result'))
  }
  return t('logbook.detail.externalResult.updated', { provider: status.provider })
}

function providerKey(provider: string, action: 'setup' | 'fetch' | 'send'): TranslationKey {
  const normalized = normalizeProvider(provider)
  if (normalized === 'qrz') return `logbook.detail.externalAction.qrz.${action}` as TranslationKey
  if (normalized === 'lotw') return `logbook.detail.externalAction.lotw.${action}` as TranslationKey
  if (normalized === 'eqsl') return `logbook.detail.externalAction.eqsl.${action}` as TranslationKey
  return 'logbook.detail.externalAction.generic'
}

function providerStatusKey(provider: string, status: string, part: 'label' | 'description' | 'result'): TranslationKey {
  const normalizedProvider = normalizeProvider(provider)
  const normalizedStatus = normalizeStatus(status)
  if (normalizedProvider === 'qrz' || normalizedProvider === 'lotw' || normalizedProvider === 'eqsl') {
    return `logbook.detail.externalStatus.${normalizedProvider}.${normalizedStatus}.${part}` as TranslationKey
  }
  return `logbook.detail.externalStatus.generic.ready.${part}` as TranslationKey
}

function normalizeProvider(provider: string) {
  const normalized = provider.toLowerCase()
  if (normalized === 'qrz') return 'qrz'
  if (normalized === 'lotw') return 'lotw'
  if (normalized === 'eqsl') return 'eqsl'
  return 'generic'
}

function normalizeStatus(status: string) {
  if (status === 'credential-error') return 'credentialError'
  if (status === 'not-configured') return 'notConfigured'
  if (['synced', 'ready', 'sent', 'confirmed', 'missing'].includes(status)) return status
  return 'ready'
}

