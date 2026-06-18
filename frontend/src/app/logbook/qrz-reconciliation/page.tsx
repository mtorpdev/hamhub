'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import type { QrzReconciliationItem, QrzReconciliationResponse, QrzReconciliationStatus } from '@/lib/types'
import { formatUtcDate } from '@/lib/utils'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { buildQrzReconciliationSummary, type QrzReconciliationSummaryCard } from './qrzReconciliationSummary'

function statusLabel(status: QrzReconciliationStatus) {
  if (status === 'InSync') return 'I sync'
  if (status === 'TimeDrift') return 'Tid afviger'
  if (status === 'HamHubOnly') return 'Kun HamHub'
  if (status === 'QrzOnly') return 'Kun QRZ'
  return status
}

function statusClass(status: QrzReconciliationStatus) {
  if (status === 'InSync') return 'border-green-800/70 bg-green-950/40 text-green-100'
  if (status === 'TimeDrift') return 'border-yellow-800/70 bg-yellow-950/40 text-yellow-100'
  if (status === 'HamHubOnly') return 'border-blue-800/70 bg-blue-950/40 text-blue-100'
  return 'border-red-800/70 bg-red-950/40 text-red-100'
}

function summaryClass(tone: QrzReconciliationSummaryCard['tone']) {
  if (tone === 'ok') return 'text-green-200'
  if (tone === 'warn') return 'text-yellow-200'
  if (tone === 'bad') return 'text-red-200'
  return 'text-blue-200'
}

export default function QrzReconciliationPage() {
  useRequireAuth()
  const [result, setResult] = useState<QrzReconciliationResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<QrzReconciliationStatus | 'all'>('all')
  const [syncing, setSyncing] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const loadReconciliation = useCallback((cancelledRef?: { cancelled: boolean }, showLoading = true) => {
    if (showLoading) {
      setLoading(true)
      setError(null)
    }
    return api.qrz.reconciliation()
      .then(data => {
        if (!cancelledRef?.cancelled) setResult(data)
      })
      .catch(err => {
        if (!cancelledRef?.cancelled) setError(err instanceof Error ? err.message : 'Kunne ikke hente QRZ afstemning')
      })
      .finally(() => {
        if (!cancelledRef?.cancelled) setLoading(false)
      })
  }, [])

  useEffect(() => {
    const cancelledRef = { cancelled: false }
    api.qrz.reconciliation()
      .then(data => {
        if (!cancelledRef.cancelled) setResult(data)
      })
      .catch(err => {
        if (!cancelledRef.cancelled) setError(err instanceof Error ? err.message : 'Kunne ikke hente QRZ afstemning')
      })
      .finally(() => {
        if (!cancelledRef.cancelled) setLoading(false)
      })

    return () => { cancelledRef.cancelled = true }
  }, [])

  const runSync = async () => {
    setSyncing(true)
    setActionMessage(null)
    setError(null)
    try {
      await api.qrz.sync()
      setActionMessage('QRZ sync er startet. Listen opdateres om lidt.')
      setTimeout(() => {
        void loadReconciliation()
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke starte QRZ sync')
    } finally {
      setSyncing(false)
    }
  }

  const summary = useMemo(() => result ? buildQrzReconciliationSummary(result) : [], [result])
  const items = useMemo(() => {
    const all = result?.items ?? []
    return filter === 'all' ? all : all.filter(item => item.status === filter)
  }, [filter, result])

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">QRZ Afstemning</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-400">
            Sammenligning mellem HamHub og QRZ Logbook med sikre handlinger. Sync kan upload/importere manglende QSOer, men sletter ikke poster i QRZ.
          </p>
        </div>
        <Link href="/logbook">
          <Button variant="secondary">Tilbage til logbog</Button>
        </Link>
      </div>

      {loading && <p className="text-gray-400">Henter QRZ logbook og matcher QSOer...</p>}
      {error && <p className="rounded border border-red-900/70 bg-red-950/30 p-4 text-sm text-red-200">{error}</p>}
      {actionMessage && <p className="mb-4 rounded border border-blue-900/70 bg-blue-950/30 p-4 text-sm text-blue-100">{actionMessage}</p>}

      {result && (
        <>
          <div className="mb-6 grid gap-3 md:grid-cols-5">
            {summary.map(card => (
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
            {(['all', 'InSync', 'TimeDrift', 'HamHubOnly', 'QrzOnly'] as const).map(value => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`rounded border px-3 py-1 ${filter === value ? 'border-blue-500 bg-blue-950/50 text-blue-100' : 'border-gray-800 bg-gray-900 text-gray-400'}`}
              >
                {value === 'all' ? 'Alle' : statusLabel(value)}
              </button>
            ))}
          </div>

          {result.qrzDuplicateGroups.length > 0 && (
            <div className="mb-4 rounded border border-yellow-800/60 bg-yellow-950/25 px-4 py-3 text-sm text-yellow-100">
              QRZ har {result.qrzDuplicateGroups.length} mulig(e) dubletgruppe(r). Brug listen som beslutningsgrundlag, før noget slettes i QRZ.
            </div>
          )}

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-800/50">
                    <tr>
                      {['Status', 'Kontakt', 'Band', 'Mode', 'HamHub UTC', 'QRZ UTC', 'Delta', 'Reference', 'Handling'].map(header => (
                        <th key={header} className="px-4 py-3 text-left font-medium text-gray-400">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {items.map((item, index) => (
                      <tr key={`${item.status}-${item.hamHubQsoId ?? 'qrz'}-${item.qrzLogId ?? index}`} className="hover:bg-gray-800/40">
                        <td className="px-4 py-3"><span className={`rounded border px-2 py-1 text-xs ${statusClass(item.status)}`}>{statusLabel(item.status)}</span></td>
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
                          <ReconciliationAction item={item} syncing={syncing} onRunSync={runSync} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {items.length === 0 && <p className="p-6 text-gray-400">Ingen poster i dette filter.</p>}
              </div>
            </CardContent>
          </Card>

          {result.qrzDuplicateGroups.length > 0 && (
            <div className="mt-6 space-y-3">
              <h2 className="text-xl font-semibold text-white">Mulige QRZ dubletter</h2>
              {result.qrzDuplicateGroups.map(group => (
                <Card key={`${group.workedCallsign}-${group.qrzLogIds.join('-')}`}>
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-white">{group.workedCallsign}</span>
                      <Badge variant="info">{group.band}</Badge>
                      <Badge>{group.mode}</Badge>
                    </div>
                    <p className="mt-2 text-xs text-gray-400">{group.qrzLogIds.map((id, index) => `${id} · ${formatUtcDate(group.datesUtc[index])}`).join(' | ')}</p>
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

function ReconciliationAction({ item, syncing, onRunSync }: { item: QrzReconciliationItem; syncing: boolean; onRunSync: () => void }) {
  if (item.recommendedAction === 'RunSync') {
    return (
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={onRunSync}
        disabled={syncing}
        title={item.actionDescription}
      >
        {syncing ? 'Starter...' : item.actionLabel}
      </Button>
    )
  }

  if (item.recommendedAction === 'ReviewTime' && item.hamHubQsoId) {
    return (
      <Link
        href={`/logbook/${item.hamHubQsoId}`}
        className="inline-flex rounded-md bg-yellow-900/50 px-3 py-1.5 text-sm font-medium text-yellow-100 hover:bg-yellow-900"
        title={item.actionDescription}
      >
        {item.actionLabel}
      </Link>
    )
  }

  return <span className="text-xs text-gray-500" title={item.actionDescription}>{item.actionLabel}</span>
}
