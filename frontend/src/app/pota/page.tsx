'use client'

import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/i18n/LanguageContext'
import { pageShellClass } from '@/lib/layout'
import { api } from '@/lib/api'
import { type PotaSpot, type Qso } from '@/lib/types'
import { buildPotaMapMarkers, filterPotaSpots, potaBandOptions, potaModeOptions, spotAgeMinutes, type PotaFilters } from './potaFilters'
import { buildPotaProgress, enrichPotaMarkers, potaSpotStatus, type PotaParkStatus, type PotaProgress } from './potaProgress'

const Map = lazy(() => import('@/components/ui/Map'))

type PotaTab = 'live' | 'map' | 'mine' | 'activation'

export default function PotaPage() {
  const { isAuthenticated } = useAuth()
  const { t, language } = useLanguage()
  const [spots, setSpots] = useState<PotaSpot[]>([])
  const [qsos, setQsos] = useState<Qso[]>([])
  const [filters, setFilters] = useState<PotaFilters>({})
  const [tab, setTab] = useState<PotaTab>('live')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)

  const statusLabel = useCallback((status: PotaParkStatus) => {
    if (status === 'confirmed') return t('pota.status.confirmed')
    if (status === 'need-qsl') return t('pota.status.needQsl')
    return t('pota.status.new')
  }, [t])

  const loadSpots = async () => {
    setLoading(true)
    try {
      const latest = await api.pota.getSpots()
      setSpots(latest)
      setLastUpdatedAt(new Date().toISOString())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('pota.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    async function loadInitial() {
      setLoading(true)
      try {
        const latest = await api.pota.getSpots()
        if (cancelled) return
        setSpots(latest)
        setLastUpdatedAt(new Date().toISOString())
        setError(null)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : t('pota.loadFailed'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadInitial()
    const id = window.setInterval(() => {
      void loadSpots()
    }, 60_000)

    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [t])

  useEffect(() => {
    let cancelled = false
    if (!isAuthenticated) {
      Promise.resolve().then(() => {
        if (!cancelled) setQsos([])
      })
      return () => { cancelled = true }
    }

    api.qsos.getMine()
      .then(items => {
        if (!cancelled) setQsos(items)
      })
      .catch(() => {
        if (!cancelled) setQsos([])
      })

    return () => { cancelled = true }
  }, [isAuthenticated])

  const filteredSpots = useMemo(() => filterPotaSpots(spots, filters), [spots, filters])
  const potaProgress = useMemo(() => buildPotaProgress(qsos), [qsos])
  const mapMarkers = useMemo(
    () => enrichPotaMarkers(buildPotaMapMarkers(filteredSpots), filteredSpots, potaProgress, statusLabel),
    [filteredSpots, potaProgress, statusLabel],
  )
  const bands = useMemo(() => potaBandOptions(spots), [spots])
  const modes = useMemo(() => potaModeOptions(spots), [spots])
  const activeParks = useMemo(() => new Set(spots.map(spot => spot.reference)).size, [spots])
  const setFilter = (key: keyof PotaFilters, value: string) => {
    setFilters(current => {
      const next = { ...current }
      if (!value.trim()) delete next[key]
      else next[key] = value
      return next
    })
  }

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <div className={`${pageShellClass} space-y-5 py-6`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">POTA</h1>
            <p className="mt-1 text-sm text-gray-400">{t('pota.description')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
            <span className="inline-flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${error ? 'bg-red-500' : 'bg-emerald-500'}`} />
              {loading ? t('pota.loadingFeed') : error ? t('pota.feedError') : t('pota.live')}
            </span>
            {lastUpdatedAt && <span>{t('pota.updated', { time: new Date(lastUpdatedAt).toLocaleTimeString(language === 'da' ? 'da-DK' : 'en-US') })}</span>}
            <button type="button" onClick={loadSpots} className="border border-gray-700 px-3 py-1.5 text-gray-200 hover:border-cyan-700">
              {t('common.refresh')}
            </button>
          </div>
        </div>

        {error && <div className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-100">{error}</div>}

        <section className="grid gap-3 md:grid-cols-4">
          <Stat label={t('pota.activeSpots')} value={spots.length} tone="text-white" />
          <Stat label={t('pota.activeParks')} value={activeParks} tone="text-cyan-200" />
          <Stat label={t('pota.onMap')} value={mapMarkers.length} tone="text-emerald-200" />
          <Stat label={t('pota.mine')} value={potaProgress.workedCount} tone="text-amber-200" />
        </section>

        <section className="grid gap-2 md:grid-cols-[1.4fr_120px_120px_1fr]">
          <input
            value={filters.search ?? ''}
            onChange={event => setFilter('search', event.target.value)}
            placeholder={t('pota.searchPlaceholder')}
            className="h-10 border border-gray-800 bg-gray-900 px-3 text-sm text-white outline-none focus:border-cyan-700"
          />
          <select value={filters.band ?? ''} onChange={event => setFilter('band', event.target.value)} className="h-10 border border-gray-800 bg-gray-900 px-3 text-sm text-white outline-none focus:border-cyan-700">
            <option value="">{t('pota.allBands')}</option>
            {bands.map(band => <option key={band} value={band}>{band}</option>)}
          </select>
          <select value={filters.mode ?? ''} onChange={event => setFilter('mode', event.target.value)} className="h-10 border border-gray-800 bg-gray-900 px-3 text-sm text-white outline-none focus:border-cyan-700">
            <option value="">{t('pota.allModes')}</option>
            {modes.map(mode => <option key={mode} value={mode}>{mode}</option>)}
          </select>
          <input
            value={filters.activator ?? ''}
            onChange={event => setFilter('activator', event.target.value.toUpperCase())}
            placeholder={t('pota.activatorPlaceholder')}
            className="h-10 border border-gray-800 bg-gray-900 px-3 text-sm text-white outline-none focus:border-cyan-700"
          />
        </section>

        <div className="flex gap-1 border-b border-gray-800">
          {([
            ['live', t('pota.tabs.live')],
            ['map', t('pota.tabs.map')],
            ['mine', t('pota.tabs.mine')],
            ['activation', t('pota.tabs.activation')],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === id ? 'border-cyan-500 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'live' && <PotaSpotTable spots={filteredSpots} loading={loading} progress={potaProgress} />}

        {tab === 'map' && (
          <Card className="border-gray-800 bg-gray-900">
            <CardContent className="space-y-3 p-4">
              <div>
                <h2 className="text-sm font-semibold text-white">{t('pota.activePotaParks')}</h2>
                <p className="mt-1 text-xs text-gray-500">{t('pota.mapCount', { count: mapMarkers.length })}</p>
              </div>
              {mapMarkers.length > 0 ? (
                <Suspense fallback={<div className="flex h-[620px] items-center justify-center border border-gray-800 bg-gray-950 text-sm text-gray-500">{t('pota.loadingMap')}</div>}>
                  <Map markers={mapMarkers} height="clamp(420px, calc(100vh - 320px), 720px)" />
                </Suspense>
              ) : (
                <div className="flex h-[420px] items-center justify-center border border-gray-800 bg-gray-950 text-sm text-gray-500">
                  {t('pota.noMapSpots')}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {tab === 'mine' && <MinePotaPanel progress={potaProgress} authenticated={isAuthenticated} />}

        {tab === 'activation' && (
          <Card className="border-gray-800 bg-gray-900">
            <CardContent className="space-y-4 p-4">
              <div>
                <h2 className="text-sm font-semibold text-white">{t('pota.activationTitle')}</h2>
                <p className="mt-1 max-w-2xl text-sm text-gray-400">{t('pota.activationDescription')}</p>
              </div>
              <a
                href="https://pota.app/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center border border-cyan-800 bg-cyan-950/40 px-4 text-sm font-semibold text-cyan-100 hover:border-cyan-600"
              >
                {t('pota.openOfficial')}
              </a>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  )
}

function PotaSpotTable({ spots, loading, progress, compact = false }: { spots: PotaSpot[]; loading: boolean; progress: PotaProgress; compact?: boolean }) {
  const { t } = useLanguage()
  const headers = [
    t('pota.table.status'),
    t('pota.table.activator'),
    t('pota.table.park'),
    t('pota.table.frequency'),
    t('pota.table.mode'),
    t('pota.table.spotter'),
    compact ? t('pota.table.age') : t('pota.table.comment'),
    t('pota.table.age'),
  ].filter((_, index) => !(compact && index === 7))

  return (
    <Card className="border-gray-800 bg-gray-900">
      <CardContent className="p-0">
        {loading && spots.length === 0 ? (
          <p className="px-4 py-8 text-sm text-gray-400">{t('pota.loadingSpots')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-950/60">
                <tr>
                  {headers.map(header => (
                    <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {spots.map(spot => (
                  <tr key={spot.spotId} className="hover:bg-gray-800/40">
                    <td className="px-4 py-3"><PotaStatusBadge status={potaSpotStatus(spot, progress)} /></td>
                    <td className="px-4 py-3 font-mono font-semibold text-white">{spot.activator}</td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-cyan-200">{spot.reference}</div>
                      <div className="mt-1 max-w-[280px] truncate text-xs text-gray-500">{spot.parkName ?? spot.locationDesc ?? '-'}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="font-mono text-gray-100">{spot.frequency}</span>
                      {spot.band && <span className="ml-2 text-xs text-gray-500">{spot.band}</span>}
                    </td>
                    <td className="px-4 py-3"><span className="border border-gray-700 px-2 py-1 text-xs text-gray-200">{spot.mode || '-'}</span></td>
                    <td className="px-4 py-3 font-mono text-gray-400">{spot.spotter ?? '-'}</td>
                    {!compact && <td className="max-w-xs truncate px-4 py-3 text-gray-400">{spot.comments ?? '-'}</td>}
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{formatSpotAge(spot, t('pota.now'))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {spots.length === 0 && <p className="px-4 py-8 text-sm text-gray-500">{t('pota.noFilteredSpots')}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function MinePotaPanel({ progress, authenticated }: { progress: PotaProgress; authenticated: boolean }) {
  const { t, language } = useLanguage()
  const refs = Array.from(progress.refs.values())
    .sort((left, right) => right.lastQsoAt.localeCompare(left.lastQsoAt) || left.reference.localeCompare(right.reference))

  if (!authenticated) {
    return (
      <div className="border border-gray-800 bg-gray-900 px-4 py-8 text-sm text-gray-400">
        {t('pota.loginForMine')}
      </div>
    )
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <Card className="border-gray-800 bg-gray-900">
        <CardContent className="space-y-3 p-4">
          <h2 className="text-sm font-semibold text-white">{t('pota.mine')}</h2>
          <div className="grid grid-cols-2 gap-2">
            <Stat label={t('pota.stats.worked')} value={progress.workedCount} tone="text-cyan-200" />
            <Stat label={t('pota.stats.confirmed')} value={progress.confirmedCount} tone="text-emerald-200" />
            <Stat label={t('pota.stats.needQsl')} value={progress.needQslCount} tone="text-amber-200" />
            <Stat label={t('pota.stats.refs')} value={refs.length} tone="text-white" />
          </div>
        </CardContent>
      </Card>
      <Card className="border-gray-800 bg-gray-900">
        <CardContent className="p-0">
          {refs.length === 0 ? (
            <p className="px-4 py-8 text-sm text-gray-500">{t('pota.noRefs')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-950/60">
                  <tr>
                    {[t('pota.table.reference'), t('pota.table.status'), t('pota.table.qsos'), t('pota.table.latestQso')].map(header => (
                      <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {refs.map(ref => (
                    <tr key={ref.reference} className="hover:bg-gray-800/40">
                      <td className="px-4 py-3 font-mono font-semibold text-cyan-200">{ref.reference}</td>
                      <td className="px-4 py-3"><PotaStatusBadge status={ref.status} /></td>
                      <td className="px-4 py-3 font-mono text-gray-200">{ref.qsoCount}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{new Date(ref.lastQsoAt).toLocaleString(language === 'da' ? 'da-DK' : 'en-US')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

function PotaStatusBadge({ status }: { status: PotaParkStatus }) {
  const { t } = useLanguage()
  const classes = {
    new: 'border-sky-700 bg-sky-950/40 text-sky-200',
    'need-qsl': 'border-amber-700 bg-amber-950/40 text-amber-200',
    confirmed: 'border-emerald-700 bg-emerald-950/40 text-emerald-200',
  }
  const label = status === 'confirmed' ? t('pota.status.confirmed') : status === 'need-qsl' ? t('pota.status.needQsl') : t('pota.status.new')
  return <span className={`whitespace-nowrap border px-2 py-1 text-xs font-semibold ${classes[status]}`}>{label}</span>
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="border border-gray-800 bg-gray-900 px-4 py-3">
      <p className="text-xs font-semibold uppercase text-gray-500">{label}</p>
      <p className={`mt-1 font-mono text-2xl font-bold ${tone}`}>{value}</p>
    </div>
  )
}

function formatSpotAge(spot: PotaSpot, nowLabel: string) {
  const minutes = spotAgeMinutes(spot.spotTimeUtc)
  if (minutes === null) return '-'
  if (minutes < 1) return nowLabel
  return `${minutes} min`
}
