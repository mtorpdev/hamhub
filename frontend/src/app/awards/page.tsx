'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Band, BandLabels, Mode, ModeLabels, type AwardBackfillResult, type AwardDataQuality, type AwardDetailResponse, type AwardEntityProgress, type AwardFilters, type AwardProgress, type AwardStatus, type AwardSummaryResponse } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/Card'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useLanguage } from '@/i18n/LanguageContext'
import { awardEntityHref } from './awardLinks'
import { awardStatusClass, buildAwardGroups, buildAwardWorkflowStats, progressPercent } from './awardSummary'
import { pageShellClass } from '@/lib/layout'
export default function AwardsPage() {
  useRequireAuth()
  const { t } = useLanguage()
  const statusOptions: Array<{ value: AwardStatus | ''; label: string }> = [
    { value: '', label: t('awards.allStatuses') },
    { value: 'active', label: t('awards.status.active') },
    { value: 'missing-data', label: t('awards.status.missingData') },
    { value: 'coming-next', label: t('awards.status.comingNext') },
  ]
  const [summary, setSummary] = useState<AwardSummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<AwardFilters>({})
  const [selectedAwardId, setSelectedAwardId] = useState<string | null>(null)
  const [detail, setDetail] = useState<AwardDetailResponse | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [backfillLoading, setBackfillLoading] = useState(false)
  const [backfillResult, setBackfillResult] = useState<AwardBackfillResult | null>(null)

  const loadSummary = () => {
    setLoading(true)
    return api.awards.getSummary(filters)
      .then(result => {
        setSummary(result)
        setError(null)
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : t('awards.loadFailed'))
      })
      .finally(() => {
        setLoading(false)
      })
  }

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
        if (!cancelled) setError(err instanceof Error ? err.message : t('awards.loadFailed'))
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
        if (!cancelled) setDetailError(err instanceof Error ? err.message : t('awards.detailLoadFailed'))
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

  const runBackfill = async () => {
    setBackfillLoading(true)
    setBackfillResult(null)
    setError(null)
    try {
      const result = await api.awards.backfill(false)
      setBackfillResult(result)
      await loadSummary()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('awards.backfillFailed'))
    } finally {
      setBackfillLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <div className={`${pageShellClass} space-y-6 py-6`}>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">{t('awards.title')}</h1>
            <p className="mt-1 text-sm text-gray-400">{t('awards.description')}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            <input
              value={filters.callsign ?? ''}
              onChange={event => setFilter('callsign', event.target.value.toUpperCase())}
              placeholder={t('awards.ownCall')}
              className="h-10 border border-gray-800 bg-gray-900 px-3 text-sm text-white outline-none focus:border-cyan-700"
            />
            <select value={filters.band ?? ''} onChange={event => setFilter('band', event.target.value ? Number(event.target.value) as Band : '')} className="h-10 border border-gray-800 bg-gray-900 px-3 text-sm text-white outline-none focus:border-cyan-700">
              <option value="">{t('awards.allBands')}</option>
              {Object.entries(BandLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select value={filters.mode ?? ''} onChange={event => setFilter('mode', event.target.value ? Number(event.target.value) as Mode : '')} className="h-10 border border-gray-800 bg-gray-900 px-3 text-sm text-white outline-none focus:border-cyan-700">
              <option value="">{t('awards.allModes')}</option>
              {Object.entries(ModeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select value={filters.sponsor ?? ''} onChange={event => setFilter('sponsor', event.target.value)} className="h-10 border border-gray-800 bg-gray-900 px-3 text-sm text-white outline-none focus:border-cyan-700">
              <option value="">{t('awards.allSponsors')}</option>
              {sponsors.map(sponsor => <option key={sponsor} value={sponsor}>{sponsor}</option>)}
            </select>
            <select value={filters.status ?? ''} onChange={event => setFilter('status', event.target.value as AwardStatus | '')} className="h-10 border border-gray-800 bg-gray-900 px-3 text-sm text-white outline-none focus:border-cyan-700">
              {statusOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        </div>

        {error && <div className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-100">{error}</div>}

        <section className="grid gap-3 md:grid-cols-5">
          <WorkflowStat label={t('awards.qsos')} value={summary?.qsoCount ?? 0} tone="text-white" />
          <WorkflowStat label={t('awards.qslConfirmed')} value={summary?.confirmedQsoCount ?? 0} tone="text-emerald-200" />
          <WorkflowStat label={t('awards.awardSlots')} value={workflowStats.worked} tone="text-cyan-200" />
          <WorkflowStat label={t('awards.needsQsl')} value={workflowStats.needsQsl} tone="text-amber-200" />
          <WorkflowStat label={t('awards.missing')} value={workflowStats.missing} tone="text-gray-200" />
        </section>

        {summary && (
          <AwardDataQualityPanel
            dataQuality={summary.dataQuality}
            backfillLoading={backfillLoading}
            backfillResult={backfillResult}
            onBackfill={runBackfill}
          />
        )}

        <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          {loading && activeAwards.length === 0 ? (
            <div className="border border-gray-800 bg-gray-900 px-4 py-8 text-sm text-gray-400">{t('awards.loading')}</div>
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
                <span>{t('awards.award')}</span>
                <span>{t('awards.status')}</span>
                <span>{t('awards.worked')}</span>
                <span>{t('awards.confirmed')}</span>
                <span>{t('awards.needsQsl')}</span>
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
                    <p className="mt-1 truncate text-xs text-gray-400">{awardDescription(award, t)}</p>
                  </div>
                  <StatusPill status={award.status} />
                  <span className="font-mono text-gray-100">{award.workedCount}</span>
                  <span className="font-mono text-emerald-200">{award.confirmedCount}</span>
                  <span className="font-mono text-amber-200">{award.unconfirmedEntities.length}</span>
                </button>
              ))}
            </div>
          ))}
          {!loading && awards.length === 0 && <div className="px-4 py-10 text-center text-sm text-gray-500">{t('awards.noMatches')}</div>}
        </section>

        {(selectedAwardId || detailLoading || detailError) && (
          <section className="border border-gray-800 bg-gray-900">
            {detailLoading && <div className="px-4 py-8 text-sm text-gray-400">{t('awards.loadingDetails')}</div>}
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
  const { t } = useLanguage()
  const percent = progressPercent(award)
  const nextText = !award.nextThreshold || award.workedCount >= award.nextThreshold
    ? t('awards.nextLevelReached')
    : t('awards.toNextLevel', { count: award.nextThreshold - award.workedCount })

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
          <Stat label={t('awards.worked')} value={award.workedCount} />
          <Stat label={t('awards.confirmed')} value={award.confirmedCount} />
          <Stat label={t('awards.missing')} value={award.missingCount} />
        </div>
        <div>
          <div className="h-2 bg-gray-800">
            <div className="h-2 bg-cyan-500" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-2 text-xs text-gray-400">{nextText}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function AwardDataQualityPanel({
  dataQuality,
  backfillLoading,
  backfillResult,
  onBackfill,
}: {
  dataQuality: AwardDataQuality
  backfillLoading: boolean
  backfillResult: AwardBackfillResult | null
  onBackfill: () => void
}) {
  const { t } = useLanguage()
  const qsoRows = dataQuality.qsos.slice(0, 12)
  const issueRows = dataQuality.issues.slice(0, 8)

  return (
    <section className="border border-gray-800 bg-gray-900">
      <div className="flex flex-col gap-1 border-b border-gray-800 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-300">{t('awards.dataQuality')}</h2>
          <p className="text-xs text-gray-500">{t('awards.issueSummary', { count: dataQuality.issueQsoCount })}</p>
          {backfillResult && (
            <p className="mt-1 text-xs text-cyan-200">
              {t('awards.backfillSummary', { scanned: backfillResult.scanned, updated: backfillResult.updated })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className={`font-mono text-lg font-bold ${dataQuality.issueQsoCount > 0 ? 'text-amber-200' : 'text-emerald-200'}`}>
            {dataQuality.issueQsoCount}
          </span>
          <button
            type="button"
            onClick={onBackfill}
            disabled={backfillLoading}
            className="h-9 border border-cyan-800 bg-cyan-950/40 px-3 text-sm font-semibold text-cyan-100 hover:border-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {backfillLoading ? t('awards.updating') : t('awards.runBackfill')}
          </button>
        </div>
      </div>

      {dataQuality.issueQsoCount === 0 ? (
        <p className="px-4 py-6 text-sm text-emerald-200">{t('awards.allFieldsComplete')}</p>
      ) : (
        <div className="grid gap-4 p-4 lg:grid-cols-[320px_1fr]">
          <div className="space-y-2">
            {issueRows.map(issue => (
              <div key={issue.field} className="border border-gray-800 bg-gray-950 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">{issue.label}</p>
                  <span className="font-mono text-sm text-amber-200">{issue.qsoCount}</span>
                </div>
                <p className="mt-1 text-xs text-gray-500">{issue.awardIds.join(', ')}</p>
              </div>
            ))}
          </div>

          <div className="overflow-hidden border border-gray-800 bg-gray-950">
            <div className="grid grid-cols-[110px_1fr_90px_1.5fr_80px] border-b border-gray-800 px-3 py-2 text-xs font-semibold uppercase text-gray-500">
              <span>{t('awards.time')}</span>
              <span>{t('awards.call')}</span>
              <span>{t('awards.bandMode')}</span>
              <span>{t('awards.missingFields')}</span>
              <span></span>
            </div>
            {qsoRows.map(qso => (
              <div key={qso.qsoId} className="grid grid-cols-[110px_1fr_90px_1.5fr_80px] items-center gap-2 border-b border-gray-800 px-3 py-2 text-sm last:border-b-0">
                <span className="font-mono text-xs text-gray-500">{qso.dateUtc.slice(0, 10)}</span>
                <span className="font-mono text-gray-100">{qso.workedCallsign}</span>
                <span className="text-xs text-gray-400">{qso.band} / {qso.mode}</span>
                <span className="flex flex-wrap gap-1">
                  {qso.missingFields.map(field => (
                    <span key={field.field} className="border border-amber-900 bg-amber-950/40 px-1.5 py-0.5 text-xs text-amber-100">
                      {field.label}
                    </span>
                  ))}
                </span>
                <Link href={`/logbook/${qso.qsoId}`} className="text-xs text-cyan-300 hover:text-cyan-100">{t('awards.editQso')}</Link>
              </div>
            ))}
            {dataQuality.qsos.length > qsoRows.length && (
              <p className="px-3 py-2 text-xs text-gray-500">{t('awards.showingRecentMissing', { visible: qsoRows.length, total: dataQuality.qsos.length })}</p>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

function AwardDetailPanel({ award, onClose }: { award: AwardProgress; onClose: () => void }) {
  const { t } = useLanguage()
  const confirmed = award.entities.filter(entity => entity.status === 'confirmed')

  return (
    <div className="space-y-5 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-white">{award.name}</h2>
            <StatusPill status={award.status} />
          </div>
          <p className="mt-1 text-sm text-gray-400">{awardDescription(award, t)}</p>
          {award.warnings.length > 0 && <p className="mt-2 text-sm text-amber-200">{award.warnings[0]}</p>}
        </div>
        <button type="button" onClick={onClose} className="h-9 border border-gray-700 px-3 text-sm text-gray-200 hover:border-gray-500">
          {t('common.close')}
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <EntityList title={t('awards.sections.worked')} entities={award.unconfirmedEntities} emptyText={t('awards.empty.worked')} tone="needs" />
        <EntityList title={t('awards.sections.missing')} entities={award.missingEntities} emptyText={t('awards.empty.missing')} limit={80} tone="missing" />
        <EntityList title={t('awards.sections.confirmed')} entities={confirmed} emptyText={t('awards.empty.confirmed')} tone="confirmed" />
      </div>
    </div>
  )
}

function EntityList({ title, entities, emptyText, limit = 40, tone = 'default' }: { title: string; entities: AwardEntityProgress[]; emptyText: string; limit?: number; tone?: 'default' | 'needs' | 'missing' | 'confirmed' }) {
  const { t } = useLanguage()
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
          {entities.length > visible.length && <p className="mt-3 text-xs text-gray-500">{t('awards.showing', { visible: visible.length, total: entities.length })}</p>}
        </div>
      ) : (
        <p className="px-3 py-6 text-sm text-gray-500">{emptyText}</p>
      )}
    </div>
  )
}

function EntityBadge({ entity }: { entity: AwardEntityProgress }) {
  const { t } = useLanguage()
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
    <Link href={href} className={className} title={t('awards.openQso')}>
      {content}
    </Link>
  ) : (
    <span className={className}>
      {content}
    </span>
  )
}

function StatusPill({ status }: { status: AwardStatus }) {
  const { t } = useLanguage()
  const label = status === 'active'
    ? t('awards.status.active')
    : status === 'missing-data'
    ? t('awards.status.missingData')
    : t('awards.status.comingNext')
  return (
    <span className={`inline-flex h-7 items-center justify-center border px-2 text-xs font-semibold ${awardStatusClass(status)}`}>
      {label}
    </span>
  )
}

function awardDescription(award: AwardProgress, t: ReturnType<typeof useLanguage>['t']) {
  if (award.id === 'dxcc') return t('awards.catalog.dxcc.description')
  if (award.id === 'dxcc-band') return t('awards.catalog.dxccBand.description')
  if (award.id === 'dxcc-mode') return t('awards.catalog.dxccMode.description')
  if (award.id === 'confirmed-dxcc') return t('awards.catalog.confirmedDxcc.description')
  if (award.id === 'wac') return t('awards.catalog.wac.description')
  if (award.id === 'wpx') return t('awards.catalog.wpx.description')
  if (award.id === 'grid') return t('awards.catalog.grid.description')
  if (award.id === 'waz') return t('awards.catalog.waz.description')
  if (award.id === 'itu-zones') return t('awards.catalog.ituZones.description')
  if (award.id === 'was') return t('awards.catalog.was.description')
  if (award.id === 'canada-provinces') return t('awards.catalog.canadaProvinces.description')
  if (award.id === 'counties') return t('awards.catalog.counties.description')
  if (award.id === 'iota') return t('awards.catalog.iota.description')
  if (award.id === 'pota') return t('awards.catalog.pota.description')
  if (award.id === 'sota') return t('awards.catalog.sota.description')
  return award.description
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
