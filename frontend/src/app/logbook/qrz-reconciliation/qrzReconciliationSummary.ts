import type { QrzReconciliationResponse } from '@/lib/types'

export interface QrzReconciliationSummaryCard {
  label: string
  value: string
  tone: 'ok' | 'warn' | 'info' | 'bad'
}

export function buildQrzReconciliationSummary(result: QrzReconciliationResponse): QrzReconciliationSummaryCard[] {
  return [
    { label: 'I sync', value: String(result.inSyncCount), tone: 'ok' },
    { label: 'Time drift', value: String(result.timeDriftCount), tone: 'warn' },
    { label: 'HamHub only', value: String(result.hamHubOnlyCount), tone: 'info' },
    { label: 'QRZ only', value: String(result.qrzOnlyCount), tone: 'bad' },
    { label: 'QRZ duplicate groups', value: String(result.qrzDuplicateGroupCount), tone: 'warn' },
  ]
}
