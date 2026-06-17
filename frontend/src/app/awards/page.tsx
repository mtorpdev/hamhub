'use client'

import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { Band, BandLabels, Mode, ModeLabels, type AwardFilters, type AwardProgress, type AwardStatus, type AwardSummaryResponse } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/Card'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { awardStatusClass, awardStatusLabel, nextThresholdText, progressPercent } from './awardSummary'

const STATUS_OPTIONS: Array<{ value: AwardStatus | ''; label: string }> = [
  { value: '', label: 'Alle statusser' },
  { value: 'active', label: 'Aktiv' },
  { value: 'missing-data', label: 'Mangler data' },
  { value: 'coming-next', label: 'Kommer næste' },
]

export default function AwardsPage() {
  useRequireAuth()
  const [summary, setSummary] = useState<AwardSummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<AwardFilters>({})

  useEffect(() => {
    let cancelled = false
    api.awards.getSummary(filters)
      .then(result => {
        if (!cancelled) {
          setSummary(result)
          setError(null)
        }
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Kunne ikke hente awards')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [filters])

  const awards = useMemo(() => summary?.awards ?? [], [summary])
  const activeAwards = awards.filter(award => award.status === 'active')
  const warnings = awards.filter(award => award.warnings.length > 0)
  const sponsors = useMemo(() => Array.from(new Set(awards.map(award => award.sponsor))).sort(), [awards])

  const setFilter = <K extends keyof AwardFilters>(key: K, value: AwardFilters[K] | '') => {
    setFilters(current => {
      const next = { ...current }
      if (value === '' || value === undefined || value === null) delete next[key]
      else next[key] = value as AwardFilters[K]
      return next
    })
  }

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Awards</h1>
            <p className="mt-1 text-sm text-gray-400">Worked, confirmed og missing progress fra din HamHub logbog.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            <input
              value={filters.callsign ?? ''}
              onChange={event => setFilter('callsign', event.target.value.toUpperCase())}
              placeholder="Eget call"
              className="h-10 border border-gray-800 bg-gray-900 px-3 text-sm text-white outline-none focus:border-cyan-700"
            />
            <select value={filters.band ?? ''} onChange={event => setFilter('band', event.target.value ? Number(event.target.value) as Band : '')} className="h-10 border border-gray-800 bg-gray-900 px-3 text-sm text-white outline-none focus:border-cyan-700">
              <option value="">Alle band</option>
              {Object.entries(BandLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select value={filters.mode ?? ''} onChange={event => setFilter('mode', event.target.value ? Number(event.target.value) as Mode : '')} className="h-10 border border-gray-800 bg-gray-900 px-3 text-sm text-white outline-none focus:border-cyan-700">
              <option value="">Alle modes</option>
              {Object.entries(ModeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select value={filters.sponsor ?? ''} onChange={event => setFilter('sponsor', event.target.value)} className="h-10 border border-gray-800 bg-gray-900 px-3 text-sm text-white outline-none focus:border-cyan-700">
              <option value="">Alle sponsorer</option>
              {sponsors.map(sponsor => <option key={sponsor} value={sponsor}>{sponsor}</option>)}
            </select>
            <select value={filters.status ?? ''} onChange={event => setFilter('status', event.target.value as AwardStatus | '')} className="h-10 border border-gray-800 bg-gray-900 px-3 text-sm text-white outline-none focus:border-cyan-700">
              {STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        </div>

        {error && <div className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-100">{error}</div>}

        <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          {loading && activeAwards.length === 0 ? (
            <div className="border border-gray-800 bg-gray-900 px-4 py-8 text-sm text-gray-400">Henter awards...</div>
          ) : activeAwards.map(award => (
            <AwardCard key={award.id} award={award} />
          ))}
        </section>

        {warnings.length > 0 && (
          <section className="grid gap-3 lg:grid-cols-2">
            {warnings.slice(0, 6).map(award => (
              <div key={award.id} className="border border-amber-900 bg-amber-950/20 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-amber-100">{award.name}</p>
                  <StatusPill status={award.status} />
                </div>
                <p className="mt-1 text-xs text-amber-200/80">{award.warnings[0]}</p>
              </div>
            ))}
          </section>
        )}

        <section className="overflow-hidden border border-gray-800 bg-gray-900">
          <div className="grid grid-cols-[1fr_96px_96px_96px_110px] border-b border-gray-800 px-4 py-2 text-xs font-semibold uppercase text-gray-500">
            <span>Award</span>
            <span>Status</span>
            <span>Worked</span>
            <span>Confirmed</span>
            <span>Missing</span>
          </div>
          {awards.map(award => (
            <div key={award.id} className="grid grid-cols-[1fr_96px_96px_96px_110px] items-center gap-2 border-b border-gray-800 px-4 py-3 text-sm last:border-b-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{award.name}</span>
                  <span className="text-xs text-gray-500">{award.sponsor}</span>
                </div>
                <p className="mt-1 truncate text-xs text-gray-400">{award.description}</p>
              </div>
              <StatusPill status={award.status} />
              <span className="font-mono text-gray-100">{award.workedCount}</span>
              <span className="font-mono text-emerald-200">{award.confirmedCount}</span>
              <span className="font-mono text-gray-300">{award.missingCount}</span>
            </div>
          ))}
          {!loading && awards.length === 0 && <div className="px-4 py-10 text-center text-sm text-gray-500">Ingen awards matcher filtrene.</div>}
        </section>
      </div>
    </main>
  )
}

function AwardCard({ award }: { award: AwardProgress }) {
  const percent = progressPercent(award)

  return (
    <Card className="border-gray-800 bg-gray-900">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">{award.name}</p>
            <p className="text-xs text-gray-500">{award.sponsor}</p>
          </div>
          <StatusPill status={award.status} />
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Worked" value={award.workedCount} />
          <Stat label="Confirmed" value={award.confirmedCount} />
          <Stat label="Missing" value={award.missingCount} />
        </div>
        <div>
          <div className="h-2 bg-gray-800">
            <div className="h-2 bg-cyan-500" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-2 text-xs text-gray-400">{nextThresholdText(award)}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function StatusPill({ status }: { status: AwardStatus }) {
  return (
    <span className={`inline-flex h-7 items-center justify-center border px-2 text-xs font-semibold ${awardStatusClass(status)}`}>
      {awardStatusLabel(status)}
    </span>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-gray-800 bg-gray-950 px-2 py-2">
      <p className="text-[10px] uppercase text-gray-500">{label}</p>
      <p className="font-mono text-lg font-bold text-white">{value}</p>
    </div>
  )
}
