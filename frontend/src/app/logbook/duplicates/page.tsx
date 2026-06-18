'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { BandLabels, ModeLabels, type QsoDuplicateGroup } from '@/lib/types'
import { formatUtcDate } from '@/lib/utils'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { buildDuplicateSummary } from './duplicateSummary'

function qsoLabel(qso: QsoDuplicateGroup['qsos'][number]) {
  return `${qso.ownCallsign} -> ${qso.workedCallsign}`
}

export default function DuplicateQsosPage() {
  useRequireAuth()
  const [groups, setGroups] = useState<QsoDuplicateGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api.qsos.getDuplicates()
      .then(items => {
        if (!cancelled) setGroups(items)
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Kunne ikke hente dubletter')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  const summary = useMemo(() => buildDuplicateSummary(groups), [groups])

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">QSO Dubletter</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-400">
            Read-only gennemgang af QSOer med samme call, band, mode og tid inden for WSJT-X tolerancen eller kendt lokal tids-offset.
          </p>
        </div>
        <Link href="/logbook">
          <Button variant="secondary">Tilbage til logbog</Button>
        </Link>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Grupper</p>
            <p className="mt-1 text-2xl font-semibold text-white">{summary.groups}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Berørte QSOer</p>
            <p className="mt-1 text-2xl font-semibold text-white">{summary.qsos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Seneste fund</p>
            <p className="mt-1 text-sm font-semibold text-white">
              {summary.latestDateUtc ? formatUtcDate(summary.latestDateUtc) : 'Ingen'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-4 rounded border border-yellow-800/60 bg-yellow-950/25 px-4 py-3 text-sm text-yellow-100">
        Ingen automatiske ændringer foretages her. Åbn de enkelte QSOer og ret dem manuelt, indtil merge/slet værktøjet er klar.
      </div>

      {loading && <p className="text-gray-400">Indlæser dubletter...</p>}
      {error && <p className="rounded border border-red-900/70 bg-red-950/30 p-4 text-sm text-red-200">{error}</p>}
      {!loading && !error && groups.length === 0 && (
        <Card>
          <CardContent className="p-6 text-gray-400">Ingen mulige dubletter fundet.</CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {groups.map(group => (
          <Card key={group.key}>
            <CardContent className="p-0">
              <div className="flex flex-col gap-3 border-b border-gray-800 px-4 py-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-mono text-xl font-bold text-white">{group.workedCallsign}</h2>
                    <Badge variant="info">{group.band}</Badge>
                    <Badge>{group.mode}</Badge>
                    <span className="text-xs text-gray-500">{group.qsos.length} QSOer</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-400">{group.reason}</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-800/40">
                    <tr>
                      {['Dato/tid (UTC)', 'QSO', 'Band', 'Mode', 'RST S/R', 'Eksterne logs', 'Handling'].map(header => (
                        <th key={header} className="px-4 py-3 text-left font-medium text-gray-400">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {group.qsos.map(qso => (
                      <tr key={qso.id} className="hover:bg-gray-800/40">
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-400">{formatUtcDate(qso.dateUtc)}</td>
                        <td className="px-4 py-3 font-mono text-white">{qsoLabel(qso)}</td>
                        <td className="px-4 py-3"><Badge variant="info">{BandLabels[qso.band] ?? group.band}</Badge></td>
                        <td className="px-4 py-3"><Badge>{ModeLabels[qso.mode] ?? group.mode}</Badge></td>
                        <td className="px-4 py-3 text-gray-400">{qso.rstSent || '-'}/{qso.rstReceived || '-'}</td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          QRZ {qso.qrzId ? 'ja' : 'nej'} · LoTW {qso.lotwConfirmedAt ? 'bekræftet' : 'ikke bekræftet'} · eQSL {qso.eqslConfirmedAt ? 'bekræftet' : 'ikke bekræftet'}
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/logbook/${qso.id}`} className="text-blue-400 hover:text-blue-300">Åbn QSO</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
