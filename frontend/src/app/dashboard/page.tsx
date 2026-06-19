'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { BandLabels, ModeLabels, type Qso, type DxSpot, type QsoMufFof2 } from '@/lib/types'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { pageShellClass } from '@/lib/layout'
import { useLanguage } from '@/i18n/LanguageContext'

export default function DashboardPage() {
  const { user } = useAuth()
  const { isLoading } = useRequireAuth()
  const { t, language } = useLanguage()
  const [recentQsos, setRecentQsos] = useState<Qso[]>([])
  const [recentSpots, setRecentSpots] = useState<DxSpot[]>([])
  const [livePropagation, setLivePropagation] = useState<QsoMufFof2 | null>(null)
  const [livePropagationTab, setLivePropagationTab] = useState<'summary' | 'website' | 'guide'>('summary')
  const locale = language === 'da' ? 'da-DK' : 'en-US'

  useEffect(() => {
    api.qsos.getMine().then(q => setRecentQsos(q.slice(0, 5))).catch(() => {})
    api.spots.getLatest(5).then(setRecentSpots).catch(() => {})
    api.propagation.live().then(setLivePropagation).catch(() => {})
  }, [])

  if (isLoading) return null

  return (
    <div className={pageShellClass}>
      <h1 className="mb-2 text-3xl font-bold text-white">
        {t('dashboard.welcome', { name: user?.callsign || user?.email || '' })}
      </h1>
      <p className="mb-8 text-gray-400">{t('dashboard.subtitle')}</p>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: t('dashboard.cards.logbook'), href: '/logbook', icon: 'LOG' },
          { label: t('dashboard.cards.newQso'), href: '/logbook/new', icon: 'QSO' },
          { label: t('dashboard.cards.stations'), href: '/stations', icon: 'RIG' },
          { label: t('dashboard.cards.dxSpots'), href: '/spots/new', icon: 'DX' },
        ].map(({ label, href, icon }) => (
          <Link key={href} href={href}>
            <Card className="cursor-pointer transition-colors hover:border-blue-600">
              <CardContent className="py-4 text-center">
                <div className="mb-2 font-mono text-2xl font-bold text-blue-300">{icon}</div>
                <p className="text-sm font-medium text-gray-300">{label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="mb-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('dashboard.livePropagation')}</CardTitle>
          {livePropagation && (
            <a className="text-sm text-blue-400" href={livePropagation.sourceUrl} target="_blank" rel="noreferrer">KC2G</a>
          )}
        </CardHeader>
        <CardContent>
          <div className="mb-4 inline-flex rounded-md border border-gray-700 bg-gray-950/60 p-1">
            {[
              { id: 'summary', label: t('dashboard.tab.summary') },
              { id: 'website', label: t('dashboard.tab.website') },
              { id: 'guide', label: t('dashboard.tab.guide') },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setLivePropagationTab(tab.id as typeof livePropagationTab)}
                className={`rounded px-3 py-1.5 text-sm transition-colors ${livePropagationTab === tab.id ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {!livePropagation ? (
            <p className="text-sm text-gray-500">{t('dashboard.loadingPropagation')}</p>
          ) : livePropagationTab === 'website' ? (
            <div className="flex flex-col gap-3">
              <div className="overflow-hidden rounded-lg border border-gray-800 bg-gray-950">
                <iframe title="KC2G live propagation" src={livePropagation.sourceUrl} className="h-[520px] w-full bg-white" loading="lazy" referrerPolicy="no-referrer" />
              </div>
              <p className="text-xs text-gray-500">
                {t('dashboard.openDirect')}{' '}
                <a className="text-blue-400 underline" href={livePropagation.sourceUrl} target="_blank" rel="noreferrer">KC2G</a>.
              </p>
            </div>
          ) : livePropagationTab === 'guide' ? (
            <PropagationGuide />
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={livePropagation.status === 'Live nowcast' ? 'success' : 'default'}>{propagationStatusLabel(livePropagation.status, t)}</Badge>
                  {livePropagation.retrievedAtUtc && (
                    <span className="text-xs text-gray-500">
                      {t('dashboard.fetchedAtUtc', { time: new Date(livePropagation.retrievedAtUtc).toLocaleTimeString(locale, { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' }) })}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-gray-400">{propagationDescription(livePropagation, t)}</p>
              </div>

              {livePropagation.ownNearestStation ? (
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-md border border-gray-800 bg-gray-950/40 p-3">
                    <p className="text-xs uppercase tracking-wide text-gray-500">{t('dashboard.nearestIonosonde')}</p>
                    <p className="mt-1 text-sm font-semibold text-white">{livePropagation.ownNearestStation.name}</p>
                    <p className="mt-1 text-xs text-gray-500">{t('dashboard.fromYourGrid', { distance: formatNumber(livePropagation.ownNearestStation.distanceKm, locale, ' km') })}</p>
                  </div>
                  <div className="rounded-md border border-gray-800 bg-gray-950/40 p-3">
                    <p className="text-xs uppercase tracking-wide text-gray-500">foF2</p>
                    <p className="mt-1 text-lg font-semibold text-white">{formatNumber(livePropagation.ownNearestStation.fof2Mhz, locale, ' MHz', 1)}</p>
                  </div>
                  <div className="rounded-md border border-gray-800 bg-gray-950/40 p-3">
                    <p className="text-xs uppercase tracking-wide text-gray-500">MUF(3000)</p>
                    <p className="mt-1 text-lg font-semibold text-white">{formatNumber(livePropagation.ownNearestStation.muf3000Mhz, locale, ' MHz', 1)}</p>
                  </div>
                </div>
              ) : (
                <p className="rounded-md border border-gray-800 bg-gray-950/40 p-3 text-sm text-gray-400">{t('dashboard.setGridLocator')}</p>
              )}

              {livePropagation.bandRecommendations.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-4">
                  {livePropagation.bandRecommendations.map(band => (
                    <div key={band.band} className={`rounded-md border px-3 py-2 ${band.supported ? 'border-emerald-900 bg-emerald-950/20' : 'border-gray-800 bg-gray-950/40'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-white">{band.band}</p>
                        <Badge variant={band.supported ? 'success' : 'default'}>{band.supported ? t('dashboard.underMuf') : t('dashboard.overMuf')}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-gray-400">{bandRecommendationReason(band, t)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('dashboard.recentQsos')}</CardTitle>
            <Link href="/logbook" className="text-sm text-blue-400">{`${t('dashboard.viewAll')} ->`}</Link>
          </CardHeader>
          <CardContent className="p-0">
            {recentQsos.length === 0 ? <p className="px-6 py-4 text-sm text-gray-500">{t('dashboard.noQsos')}</p> : (
              <div className="divide-y divide-gray-700">
                {recentQsos.map(q => (
                  <div key={q.id} className="flex items-center justify-between px-6 py-3">
                    <div>
                      <span className="font-mono font-bold text-white">{q.workedCallsign}</span>
                      <span className="ml-2 text-xs text-gray-500">{q.country}</span>
                    </div>
                    <div className="flex gap-1.5">
                      <Badge variant="info">{BandLabels[q.band]}</Badge>
                      <Badge>{ModeLabels[q.mode]}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('dashboard.recentSpots')}</CardTitle>
            <Link href="/spots" className="text-sm text-blue-400">{`${t('dashboard.viewAll')} ->`}</Link>
          </CardHeader>
          <CardContent className="p-0">
            {recentSpots.length === 0 ? <p className="px-6 py-4 text-sm text-gray-500">{t('dashboard.noSpots')}</p> : (
              <div className="divide-y divide-gray-700">
                {recentSpots.map(s => (
                  <div key={s.id} className="flex items-center justify-between px-6 py-3">
                    <span className="font-mono font-bold text-white">{s.callsign}</span>
                    <div className="flex gap-1.5">
                      <Badge variant="info">{BandLabels[s.band]}</Badge>
                      <Badge>{ModeLabels[s.mode]}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function PropagationGuide() {
  const { t } = useLanguage()
  const items = [
    { title: 'MUF(3000)', text: t('dashboard.guide.muf') },
    { title: 'foF2', text: t('dashboard.guide.fof2') },
    { title: 'Kp', text: t('dashboard.guide.kp') },
    { title: 'G / R / S', text: t('dashboard.guide.grs') },
    { title: 'Solar flux / SFI', text: t('dashboard.guide.sfi') },
    { title: 'D-RAP', text: t('dashboard.guide.drap') },
  ]

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {items.map(item => (
        <div key={item.title} className="rounded-md border border-gray-800 bg-gray-950/40 p-4">
          <h3 className="text-sm font-semibold text-white">{item.title}</h3>
          <p className="mt-2 text-sm leading-6 text-gray-400">{item.text}</p>
        </div>
      ))}

      <div className="rounded-md border border-blue-900/60 bg-blue-950/20 p-4 lg:col-span-2">
        <h3 className="text-sm font-semibold text-white">{t('dashboard.guide.readingTitle')}</h3>
        <p className="mt-2 text-sm leading-6 text-blue-100">{t('dashboard.guide.readingText')}</p>
      </div>
    </div>
  )
}

function formatNumber(value: number | null | undefined, locale: string, suffix = '', digits = 0) {
  if (value == null || Number.isNaN(value)) return '-'
  return `${value.toLocaleString(locale, { maximumFractionDigits: digits, minimumFractionDigits: digits })}${suffix}`
}

function propagationStatusLabel(status: string, t: ReturnType<typeof useLanguage>['t']) {
  if (status === 'Live nowcast') return t('dashboard.propagation.status.live')
  if (status === 'Ingen' + ' stationer') return t('dashboard.propagation.status.noStations')
  return t('dashboard.propagation.status.unavailable')
}

function propagationDescription(snapshot: QsoMufFof2, t: ReturnType<typeof useLanguage>['t']) {
  if (snapshot.status === 'Live nowcast') return t('dashboard.propagation.description.live')
  if (snapshot.status === 'Ingen' + ' stationer') return t('dashboard.propagation.description.noStations')
  return t('dashboard.propagation.description.unavailable')
}

function bandRecommendationReason(band: QsoMufFof2['bandRecommendations'][number], t: ReturnType<typeof useLanguage>['t']) {
  return band.supported
    ? t('dashboard.propagation.bandUnderReason', { band: band.band })
    : t('dashboard.propagation.bandOverReason', { band: band.band })
}
