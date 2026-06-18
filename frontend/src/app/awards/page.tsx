'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Band, BandLabels, Mode, ModeLabels, type AwardDetailResponse, type AwardEntityProgress, type AwardFilters, type AwardProgress, type AwardStatus, type AwardSummaryResponse } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/Card'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { awardEntityHref } from './awardLinks'
import { awardEntitySectionLabel, awardStatusClass, awardStatusLabel, buildAwardGroups, buildAwardWorkflowStats, nextThresholdText, progressPercent } from './awardSummary'

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
  const [selectedAwardId, setSelectedAwardId] = useState<string | null>(null)
  const [detail, setDetail] = useState<AwardDetailResponse | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

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

  useEffect(() => {
    if (!selectedAwardId) return

    let cancelled = false
    api.awards.getDetail(selectedAwardId, filters)
      .then(result => {
        if (!cancelled) {
          setDetail(result)
          setDetailError(null)
        }
      })
      .catch(err => {
        if (!cancelled) setDetailError(err instanceof Error ? err.message : 'Kunne ikke hente award detaljer')
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })

    return () => { cancelled = true }
  }, [filters, selectedAwardId])

  const awards = useMemo(() => summary?.awards ?? [], [summary])
  const activeAwards = awards.filter(award => award.status === 'active')
  const awardGroups = useMemo(() => buildAwardGroups(awards), [awards])
  const workflowStats = useMemo(() => buildAwardWorkflowStats(activeAwards), [activeAwards])
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

  const selectAward = (id: string) => {
    setSelectedAwardId(id)
    setDetail(null)
    setDetailError(null)
    setDetailLoading(true)
  }

  const closeDetail = () => {
    setSelectedAwardId(null)
    setDetail(null)
    setDetailError(null)
    setDetailLoading(false)
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

        <section className="grid gap-3 md:grid-cols-5">
          <WorkflowStat label="QSOer" value={summary?.qsoCount ?? 0} tone="text-white" />
          <WorkflowStat label="Worked entities" value={workflowStats.worked} tone="text-cyan-200" />
          <WorkflowStat label="Confirmed entities" value={workflowStats.confirmed} tone="text-emerald-200" />
          <WorkflowStat label="Needs QSL" value={workflowStats.needsQsl} tone="text-amber-200" />
          <WorkflowStat label="Missing" value={workflowStats.missing} tone="text-gray-200" />
        </section>

        <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          {loading && activeAwards.length === 0 ? (
            <div className="border border-gray-800 bg-gray-900 px-4 py-8 text-sm text-gray-400">Henter awards...</div>
          ) : activeAwards.map(award => (
            <AwardCard key={award.id} award={award} selected={selectedAwardId === award.id} onSelect={() => selectAward(award.id)} />
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

        <section className="space-y-3">
          {awardGroups.map(group => (
            <div key={group.sponsor} className="overflow-hidden border border-gray-800 bg-gray-900">
              <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-300">{group.sponsor}</h2>
                <span className="font-mono text-xs text-gray-500">{group.awards.length}</span>
              </div>
              <div className="grid grid-cols-[1fr_96px_96px_96px_110px] border-b border-gray-800 px-4 py-2 text-xs font-semibold uppercase text-gray-500">
                <span>Award</span>
                <span>Status</span>
                <span>Worked</span>
                <span>Confirmed</span>
                <span>Needs QSL</span>
              </div>
              {group.awards.map(award => (
                <button
                  key={award.id}
                  type="button"
                  onClick={() => selectAward(award.id)}
                  className={`grid w-full grid-cols-[1fr_96px_96px_96px_110px] items-center gap-2 border-b border-gray-800 px-4 py-3 text-left text-sm last:border-b-0 hover:bg-gray-800 focus:bg-gray-800 focus:outline-none ${selectedAwardId === award.id ? 'bg-gray-800' : ''}`}
                >
                  <div className="min-w-0">
                    <span className="font-semibold text-white">{award.name}</span>
                    <p className="mt-1 truncate text-xs text-gray-400">{award.description}</p>
                  </div>
                  <StatusPill status={award.status} />
                  <span className="font-mono text-gray-100">{award.workedCount}</span>
                  <span className="font-mono text-emerald-200">{award.confirmedCount}</span>
                  <span className="font-mono text-amber-200">{award.unconfirmedEntities.length}</span>
                </button>
              ))}
            </div>
          ))}
          {!loading && awards.length === 0 && <div className="px-4 py-10 text-center text-sm text-gray-500">Ingen awards matcher filtrene.</div>}
        </section>

        {(selectedAwardId || detailLoading || detailError) && (
          <section className="border border-gray-800 bg-gray-900">
            {detailLoading && <div className="px-4 py-8 text-sm text-gray-400">Henter award detaljer...</div>}
            {detailError && <div className="px-4 py-4 text-sm text-red-200">{detailError}</div>}
            {detail && !detailLoading && (
              <AwardDetailPanel award={detail.award} onClose={closeDetail} />
            )}
          </section>
        )}
      </div>
    </main>
  )
}

function AwardCard({ award, selected, onSelect }: { award: AwardProgress; selected: boolean; onSelect: () => void }) {
  const percent = progressPercent(award)

  return (
    <Card className={`border-gray-800 bg-gray-900 ${selected ? 'ring-1 ring-cyan-500' : ''}`}>
      <CardContent className="space-y-3 p-4">
        <button type="button" onClick={onSelect} className="flex w-full items-start justify-between gap-3 text-left focus:outline-none">
          <div>
            <p className="text-sm font-semibold text-white">{award.name}</p>
            <p className="text-xs text-gray-500">{award.sponsor}</p>
          </div>
          <StatusPill status={award.status} />
        </button>
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

function AwardDetailPanel({ award, onClose }: { award: AwardProgress; onClose: () => void }) {
  const confirmed = award.entities.filter(entity => entity.status === 'confirmed')

  return (
    <div className="space-y-5 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-white">{award.name}</h2>
            <StatusPill status={award.status} />
          </div>
          <p className="mt-1 text-sm text-gray-400">{award.description}</p>
          {award.warnings.length > 0 && <p className="mt-2 text-sm text-amber-200">{award.warnings[0]}</p>}
        </div>
        <button type="button" onClick={onClose} className="h-9 border border-gray-700 px-3 text-sm text-gray-200 hover:border-gray-500">
          Luk
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <EntityList title={awardEntitySectionLabel('worked')} entities={award.unconfirmedEntities} emptyText="Ingen worked entities der mangler QSL." tone="needs" />
        <EntityList title={awardEntitySectionLabel('missing')} entities={award.missingEntities} emptyText="Ingen missing entities." limit={80} tone="missing" />
        <EntityList title={awardEntitySectionLabel('confirmed')} entities={confirmed} emptyText="Ingen confirmed entities endnu." tone="confirmed" />
      </div>
    </div>
  )
}

function EntityList({ title, entities, emptyText, limit = 40, tone = 'default' }: { title: string; entities: AwardEntityProgress[]; emptyText: string; limit?: number; tone?: 'default' | 'needs' | 'missing' | 'confirmed' }) {
  const visible = entities.slice(0, limit)
  const headerClass = tone === 'needs'
    ? 'text-amber-300'
    : tone === 'confirmed'
    ? 'text-emerald-300'
    : tone === 'missing'
    ? 'text-gray-300'
    : 'text-gray-400'

  return (
    <div className="border border-gray-800 bg-gray-950">
      <div className="flex items-center justify-between border-b border-gray-800 px-3 py-2">
        <h3 className={`text-xs font-semibold uppercase ${headerClass}`}>{title}</h3>
        <span className="font-mono text-xs text-gray-500">{entities.length}</span>
      </div>
      {visible.length > 0 ? (
        <div className="max-h-72 overflow-y-auto p-2">
          <div className="flex flex-wrap gap-2">
            {visible.map(entity => <EntityBadge key={entity.key} entity={entity} />)}
          </div>
          {entities.length > visible.length && <p className="mt-3 text-xs text-gray-500">Viser {visible.length} af {entities.length}.</p>}
        </div>
      ) : (
        <p className="px-3 py-6 text-sm text-gray-500">{emptyText}</p>
      )}
    </div>
  )
}

function EntityBadge({ entity }: { entity: AwardEntityProgress }) {
  const href = awardEntityHref(entity)
  const className = 'inline-flex items-center gap-1 border border-gray-800 bg-gray-900 px-2 py-1 font-mono text-xs text-gray-200 hover:border-cyan-700 hover:text-white'
  const content = (
    <>
      <span>{entity.label}</span>
      {entity.confirmationSources.map(source => (
        <span key={source} className="border border-emerald-900 bg-emerald-950 px-1 text-[10px] text-emerald-200">
          {source}
        </span>
      ))}
    </>
  )

  return href ? (
    <Link href={href} className={className} title="Ã…bn QSO i logbogen">
      {content}
    </Link>
  ) : (
    <span className={className}>
      {content}
    </span>
  )
}

function StatusPill({ status }: { status: AwardStatus }) {
  return (
    <span className={`inline-flex h-7 items-center justify-center border px-2 text-xs font-semibold ${awardStatusClass(status)}`}>
      {awardStatusLabel(status)}
    </span>
  )
}

function WorkflowStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="border border-gray-800 bg-gray-900 px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-1 font-mono text-2xl font-bold ${tone}`}>{value}</p>
    </div>
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
