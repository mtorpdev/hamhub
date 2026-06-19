'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import type { QrzReconciliationAction, QrzReconciliationItem, QrzReconciliationResponse, QrzReconciliationStatus } from '@/lib/types'
import { formatUtcDate } from '@/lib/utils'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { useLanguage } from '@/i18n/LanguageContext'
import { pageShellClass } from '@/lib/layout'

type SummaryTone = 'ok' | 'warn' | 'info' | 'bad'

function statusClass(status: QrzReconciliationStatus) {
  if (status === 'InSync') return 'border-green-800/70 bg-green-950/40 text-green-100'
  if (status === 'TimeDrift') return 'border-yellow-800/70 bg-yellow-950/40 text-yellow-100'
  if (status === 'HamHubOnly') return 'border-blue-800/70 bg-blue-950/40 text-blue-100'
  return 'border-red-800/70 bg-red-950/40 text-red-100'
}

function summaryClass(tone: SummaryTone) {
  if (tone === 'ok') return 'text-green-200'
  if (tone === 'warn') return 'text-yellow-200'
  if (tone === 'bad') return 'text-red-200'
  return 'text-blue-200'
}

export default function QrzReconciliationPage() {
  useRequireAuth()
  const { t } = useLanguage()
  const [result, setResult] = useState<QrzReconciliationResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<QrzReconciliationStatus | 'all'>('all')
  const [applyingKey, setApplyingKey] = useState<string | null>(null)
  const [deletingQrzLogId, setDeletingQrzLogId] = useState<string | null>(null)
  const [pendingDeleteQrzLogId, setPendingDeleteQrzLogId] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const loadReconciliation = useCallback((cancelledRef?: { cancelled: boolean }, showLoading = true) => {
    if (showLoading) {
      setLoading(true)
      setError(null)
    }
    return api.qrz.reconciliation()
      .then((data) => {
        if (!cancelledRef?.cancelled) setResult(data)
      })
      .catch((err) => {
        if (!cancelledRef?.cancelled) setError(err instanceof Error ? err.message : t('logbook.qrzRecon.loadFailed'))
      })
      .finally(() => {
        if (!cancelledRef?.cancelled) setLoading(false)
      })
  }, [t])

  useEffect(() => {
    const cancelledRef = { cancelled: false }
    void loadReconciliation(cancelledRef)
    return () => { cancelledRef.cancelled = true }
  }, [loadReconciliation])

  const applyAction = async (item: QrzReconciliationItem) => {
    const key = actionKey(item)
    setApplyingKey(key)
    setActionMessage(null)
    setError(null)
    try {
      const response = await api.qrz.applyReconciliation({
        action: item.recommendedAction,
        hamHubQsoId: item.hamHubQsoId,
        qrzLogId: item.qrzLogId,
      })
      setActionMessage(qrzResultMessage(response.status, t))
      await loadReconciliation()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('logbook.qrzRecon.actionFailed'))
    } finally {
      setApplyingKey(null)
    }
  }

  const deleteDuplicate = async (qrzLogId: string) => {
    if (pendingDeleteQrzLogId !== qrzLogId) {
      setPendingDeleteQrzLogId(qrzLogId)
      return
    }

    setDeletingQrzLogId(qrzLogId)
    setActionMessage(null)
    setError(null)
    try {
      const response = await api.qrz.deleteDuplicate({ qrzLogId })
      setActionMessage(qrzResultMessage(response.status, t))
      setPendingDeleteQrzLogId(null)
      await loadReconciliation()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('logbook.qrzRecon.deleteFailed'))
    } finally {
      setDeletingQrzLogId(null)
    }
  }

  const summary = useMemo(() => result ? [
    { label: statusLabel('InSync', t), value: String(result.inSyncCount), tone: 'ok' as const },
    { label: statusLabel('TimeDrift', t), value: String(result.timeDriftCount), tone: 'warn' as const },
    { label: statusLabel('HamHubOnly', t), value: String(result.hamHubOnlyCount), tone: 'info' as const },
    { label: statusLabel('QrzOnly', t), value: String(result.qrzOnlyCount), tone: 'bad' as const },
    { label: t('logbook.qrzRecon.duplicateGroups'), value: String(result.qrzDuplicateGroupCount), tone: 'warn' as const },
  ] : [], [result, t])

  const items = useMemo(() => {
    const all = result?.items ?? []
    return filter === 'all' ? all : all.filter((item) => item.status === filter)
  }, [filter, result])

  const headers = [
    t('decode.raw.status'),
    t('qso.contact'),
    t('qso.band'),
    t('qso.mode'),
    'HamHub UTC',
    'QRZ UTC',
    'Delta',
    t('logbook.qrzRecon.reference'),
    t('admin.articles.actionsColumn'),
  ]

  return (
    <div className={pageShellClass}>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">{t('logbook.qrzRecon.title')}</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-400">{t('logbook.qrzRecon.description')}</p>
        </div>
        <Link href="/logbook">
          <Button variant="secondary">{t('logbook.backToLogbook')}</Button>
        </Link>
      </div>

      {loading && <p className="text-gray-400">{t('logbook.qrzRecon.loading')}</p>}
      {error && <p className="rounded border border-red-900/70 bg-red-950/30 p-4 text-sm text-red-200">{error}</p>}
      {actionMessage && <p className="mb-4 rounded border border-blue-900/70 bg-blue-950/30 p-4 text-sm text-blue-100">{actionMessage}</p>}

      {result && (
        <>
          <div className="mb-6 grid gap-3 md:grid-cols-5">
            {summary.map((card) => (
              <Card key={card.label}>
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">{card.label}</p>
                  <p className={`mt-1 text-2xl font-semibold ${summaryClass(card.tone)}`}>{card.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-gray-500">HamHub: {result.hamHubCount}</span>
            <span className="text-gray-500">QRZ: {result.qrzCount}</span>
            {(['all', 'InSync', 'TimeDrift', 'HamHubOnly', 'QrzOnly'] as const).map((value) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`rounded border px-3 py-1 ${filter === value ? 'border-blue-500 bg-blue-950/50 text-blue-100' : 'border-gray-800 bg-gray-900 text-gray-400'}`}
              >
                {value === 'all' ? t('awards.allStatuses') : statusLabel(value, t)}
              </button>
            ))}
          </div>

          {result.qrzDuplicateGroups.length > 0 && (
            <div className="mb-4 rounded border border-yellow-800/60 bg-yellow-950/25 px-4 py-3 text-sm text-yellow-100">
              {t('logbook.qrzRecon.duplicateWarning', { count: result.qrzDuplicateGroups.length })}
            </div>
          )}

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-800/50">
                    <tr>
                      {headers.map((header) => (
                        <th key={header} className="px-4 py-3 text-left font-medium text-gray-400">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {items.map((item, index) => (
                      <tr key={`${item.status}-${item.hamHubQsoId ?? 'qrz'}-${item.qrzLogId ?? index}`} className="hover:bg-gray-800/40">
                        <td className="px-4 py-3"><span className={`rounded border px-2 py-1 text-xs ${statusClass(item.status)}`}>{statusLabel(item.status, t)}</span></td>
                        <td className="px-4 py-3 font-mono font-bold text-white">{item.workedCallsign}</td>
                        <td className="px-4 py-3"><Badge variant="info">{item.band}</Badge></td>
                        <td className="px-4 py-3"><Badge>{item.mode}</Badge></td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-400">{item.hamHubDateUtc ? formatUtcDate(item.hamHubDateUtc) : '-'}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-400">{item.qrzDateUtc ? formatUtcDate(item.qrzDateUtc) : '-'}</td>
                        <td className="px-4 py-3 text-gray-400">{item.timeDeltaSeconds === null ? '-' : `${item.timeDeltaSeconds}s`}</td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {item.hamHubQsoId ? <Link href={`/logbook/${item.hamHubQsoId}`} className="text-blue-400 hover:text-blue-300">QSO #{item.hamHubQsoId}</Link> : item.qrzLogId ? `QRZ ${item.qrzLogId}` : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <ReconciliationAction item={item} applyingKey={applyingKey} onApply={applyAction} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {items.length === 0 && <p className="p-6 text-gray-400">{t('logbook.qrzRecon.emptyFilter')}</p>}
              </div>
            </CardContent>
          </Card>

          {result.qrzDuplicateGroups.length > 0 && (
            <div className="mt-6 space-y-3">
              <h2 className="text-xl font-semibold text-white">{t('logbook.qrzRecon.possibleQrzDuplicates')}</h2>
              {result.qrzDuplicateGroups.map((group) => (
                <Card key={`${group.workedCallsign}-${group.qrzLogIds.join('-')}`}>
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-white">{group.workedCallsign}</span>
                      <Badge variant="info">{group.band}</Badge>
                      <Badge>{group.mode}</Badge>
                    </div>
                    <div className="mt-3 divide-y divide-gray-800 rounded border border-gray-800">
                      {group.qrzLogIds.map((id, index) => {
                        const pending = pendingDeleteQrzLogId === id
                        const deleting = deletingQrzLogId === id
                        return (
                          <div key={id} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="font-mono text-sm text-white">QRZ {id}</p>
                              <p className="text-xs text-gray-400">{formatUtcDate(group.datesUtc[index])}</p>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant={pending ? 'danger' : 'secondary'}
                              onClick={() => deleteDuplicate(id)}
                              disabled={deleting}
                              title={t('logbook.qrzRecon.deleteDuplicateTitle')}
                            >
                              {deleting ? t('common.deleting') : pending ? t('logbook.qrzRecon.confirmDelete') : t('logbook.qrzRecon.selectForDelete')}
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ReconciliationAction({ item, applyingKey, onApply }: { item: QrzReconciliationItem; applyingKey: string | null; onApply: (item: QrzReconciliationItem) => void }) {
  const { t } = useLanguage()
  const key = actionKey(item)
  const applying = applyingKey === key

  if (item.recommendedAction === 'UploadLocal' || item.recommendedAction === 'ImportFromQrz' || item.recommendedAction === 'ReviewTime' || item.recommendedAction === 'RunSync') {
    return (
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => onApply(item)}
        disabled={applying}
        title={actionDescription(item.recommendedAction, t)}
      >
        {applying ? t('common.working') : actionLabel(item.recommendedAction, t)}
      </Button>
    )
  }

  return <span className="text-xs text-gray-500" title={actionDescription(item.recommendedAction, t)}>{actionLabel(item.recommendedAction, t)}</span>
}

function actionKey(item: QrzReconciliationItem) {
  return `${item.recommendedAction}-${item.hamHubQsoId ?? 'qrz'}-${item.qrzLogId ?? item.workedCallsign}`
}

function statusLabel(status: QrzReconciliationStatus, t: ReturnType<typeof useLanguage>['t']) {
  if (status === 'InSync') return t('logbook.qrzRecon.status.inSync')
  if (status === 'TimeDrift') return t('logbook.qrzRecon.status.timeDrift')
  if (status === 'HamHubOnly') return t('logbook.qrzRecon.status.hamHubOnly')
  if (status === 'QrzOnly') return t('logbook.qrzRecon.status.qrzOnly')
  return status
}

function actionLabel(action: QrzReconciliationAction, t: ReturnType<typeof useLanguage>['t']) {
  if (action === 'UploadLocal') return t('logbook.qrzRecon.action.uploadLocal')
  if (action === 'ImportFromQrz') return t('logbook.qrzRecon.action.importFromQrz')
  if (action === 'ReviewTime') return t('logbook.qrzRecon.action.reviewTime')
  if (action === 'RunSync') return t('logbook.qrzRecon.action.runSync')
  return t('logbook.qrzRecon.action.none')
}

function actionDescription(action: QrzReconciliationAction, t: ReturnType<typeof useLanguage>['t']) {
  if (action === 'UploadLocal') return t('logbook.qrzRecon.actionDescription.uploadLocal')
  if (action === 'ImportFromQrz') return t('logbook.qrzRecon.actionDescription.importFromQrz')
  if (action === 'ReviewTime') return t('logbook.qrzRecon.actionDescription.reviewTime')
  if (action === 'RunSync') return t('logbook.qrzRecon.actionDescription.runSync')
  return t('logbook.qrzRecon.actionDescription.none')
}

function qrzResultMessage(status: string, t: ReturnType<typeof useLanguage>['t']) {
  if (status === 'already-linked') return t('logbook.qrzRecon.result.alreadyLinked')
  if (status === 'uploaded') return t('logbook.qrzRecon.result.uploaded')
  if (status === 'linked') return t('logbook.qrzRecon.result.linked')
  if (status === 'imported') return t('logbook.qrzRecon.result.imported')
  if (status === 'time-updated') return t('logbook.qrzRecon.result.timeUpdated')
  if (status === 'deleted') return t('logbook.qrzRecon.result.deleted')
  return t('logbook.qrzRecon.result.generic')
}
