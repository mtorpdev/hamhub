import type { QrzReconciliationResponse } from '@/lib/types'

export interface QrzReconciliationSummaryCard {
  label: string
  value: string
  tone: 'ok' | 'warn' | 'info' | 'bad'
}

export function buildQrzReconciliationSummary(result: QrzReconciliationResponse): QrzReconciliationSummaryCard[] {
  return [
    { label: 'I sync', value: String(result.inSyncCount), tone: 'ok' },
    { label: 'Tid afviger', value: String(result.timeDriftCount), tone: 'warn' },
    { label: 'Kun HamHub', value: String(result.hamHubOnlyCount), tone: 'info' },
    { label: 'Kun QRZ', value: String(result.qrzOnlyCount), tone: 'bad' },
    { label: 'QRZ dubletgrupper', value: String(result.qrzDuplicateGroupCount), tone: 'warn' },
  ]
}
