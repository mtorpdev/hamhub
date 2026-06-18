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

export default function DashboardPage() {
  const { user } = useAuth()
  const { isLoading } = useRequireAuth()
  const [recentQsos, setRecentQsos] = useState<Qso[]>([])
  const [recentSpots, setRecentSpots] = useState<DxSpot[]>([])
  const [livePropagation, setLivePropagation] = useState<QsoMufFof2 | null>(null)
  const [livePropagationTab, setLivePropagationTab] = useState<'summary' | 'website' | 'guide'>('summary')

  useEffect(() => {
    api.qsos.getMine().then(q => setRecentQsos(q.slice(0, 5))).catch(() => {})
    api.spots.getLatest(5).then(setRecentSpots).catch(() => {})
    api.propagation.live().then(setLivePropagation).catch(() => {})
  }, [])

  if (isLoading) return null

  return (
    <div className={pageShellClass}>
      <h1 className="text-3xl font-bold text-white mb-2">
        Velkommen, {user?.callsign || user?.email}
      </h1>
      <p className="text-gray-400 mb-8">Din amatørradio oversigt</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Logbog', href: '/logbook', icon: '📻' },
          { label: 'Ny QSO', href: '/logbook/new', icon: '➕' },
          { label: 'Stationer', href: '/stations', icon: '🗼' },
          { label: 'DX Spots', href: '/spots/new', icon: '📡' },
        ].map(({ label, href, icon }) => (
          <Link key={href} href={href}>
            <Card className="hover:border-blue-600 transition-colors cursor-pointer">
              <CardContent className="py-4 text-center">
                <div className="text-3xl mb-2">{icon}</div>
                <p className="text-sm font-medium text-gray-300">{label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="mb-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Live propagation</CardTitle>
          {livePropagation && (
            <a className="text-sm text-blue-400" href={livePropagation.sourceUrl} target="_blank" rel="noreferrer">
              KC2G
            </a>
          )}
        </CardHeader>
        <CardContent>
          <div className="mb-4 inline-flex rounded-md border border-gray-700 bg-gray-950/60 p-1">
            {[
              { id: 'summary', label: 'Oversigt' },
              { id: 'website', label: 'Website' },
              { id: 'guide', label: 'Forklaring' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setLivePropagationTab(tab.id as typeof livePropagationTab)}
                className={`rounded px-3 py-1.5 text-sm transition-colors ${
                  livePropagationTab === tab.id
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {!livePropagation ? (
            <p className="text-sm text-gray-500">Henter live MUF/foF2...</p>
          ) : livePropagationTab === 'website' ? (
            <div className="flex flex-col gap-3">
              <div className="overflow-hidden rounded-lg border border-gray-800 bg-gray-950">
                <iframe
                  title="KC2G live propagation"
                  src={livePropagation.sourceUrl}
                  className="h-[520px] w-full bg-white"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              </div>
              <p className="text-xs text-gray-500">
                Hvis siden ikke vises i rammen, kan den åbnes direkte hos{' '}
                <a className="text-blue-400 underline" href={livePropagation.sourceUrl} target="_blank" rel="noreferrer">
                  KC2G
                </a>.
              </p>
            </div>
          ) : livePropagationTab === 'guide' ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {[
                {
                  title: 'MUF(3000)',
                  text: 'Maximum Usable Frequency for en cirka 3000 km radiovej. Hvis MUF er over et bånds frekvens, er båndet mere sandsynligt brugbart via ionosfæren.',
                },
                {
                  title: 'foF2',
                  text: 'Den kritiske frekvens for F2-laget direkte over en ionosonde. Højere foF2 betyder typisk bedre mulighed for højere HF-bånd.',
                },
                {
                  title: 'Kp',
                  text: 'Global geomagnetisk uro fra 0 til 9. Lav Kp er roligt. Høj Kp kan give aurora, støj og dårligere polar/HF-forhold.',
                },
                {
                  title: 'G / R / S',
                  text: 'NOAA-skalaer for geomagnetiske storme, radio blackouts og solpartikelstorme. Højere tal betyder større risiko for forstyrrelser.',
                },
                {
                  title: 'Solar flux / SFI',
                  text: 'Et groft mål for solaktivitet ved 10,7 cm. Højere SFI kan løfte de højere HF-bånd, især 15m, 12m og 10m.',
                },
                {
                  title: 'D-RAP',
                  text: 'Viser mulig D-lags absorption. Det rammer især lavere HF-bånd og solbelyste ruter ved kraftig røntgenaktivitet.',
                },
              ].map(item => (
                <div key={item.title} className="rounded-md border border-gray-800 bg-gray-950/40 p-4">
                  <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-400">{item.text}</p>
                </div>
              ))}

              <div className="rounded-md border border-blue-900/60 bg-blue-950/20 p-4 lg:col-span-2">
                <h3 className="text-sm font-semibold text-white">Sådan læser du widgetten</h3>
                <p className="mt-2 text-sm leading-6 text-blue-100">
                  Start med MUF(3000): ligger den over et bånd, er båndet værd at prøve. Kig derefter på Kp og D-RAP:
                  høj uro eller absorption kan forklare, hvorfor et ellers lovende bånd ikke spiller. Brug tallene som
                  en aktuel indikator, ikke som garanti.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={livePropagation.status === 'Live nowcast' ? 'success' : 'default'}>
                    {livePropagation.status}
                  </Badge>
                  {livePropagation.retrievedAtUtc && (
                    <span className="text-xs text-gray-500">
                      Hentet {new Date(livePropagation.retrievedAtUtc).toLocaleTimeString('da-DK', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' })} UTC
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-gray-400">{livePropagation.description}</p>
              </div>

              {livePropagation.ownNearestStation ? (
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-md border border-gray-800 bg-gray-950/40 p-3">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Nærmeste ionosonde</p>
                    <p className="mt-1 text-sm font-semibold text-white">{livePropagation.ownNearestStation.name}</p>
                    <p className="mt-1 text-xs text-gray-500">{formatNumber(livePropagation.ownNearestStation.distanceKm, ' km')} fra dit grid</p>
                  </div>
                  <div className="rounded-md border border-gray-800 bg-gray-950/40 p-3">
                    <p className="text-xs uppercase tracking-wide text-gray-500">foF2</p>
                    <p className="mt-1 text-lg font-semibold text-white">{formatNumber(livePropagation.ownNearestStation.fof2Mhz, ' MHz', 1)}</p>
                  </div>
                  <div className="rounded-md border border-gray-800 bg-gray-950/40 p-3">
                    <p className="text-xs uppercase tracking-wide text-gray-500">MUF(3000)</p>
                    <p className="mt-1 text-lg font-semibold text-white">{formatNumber(livePropagation.ownNearestStation.muf3000Mhz, ' MHz', 1)}</p>
                  </div>
                </div>
              ) : (
                <p className="rounded-md border border-gray-800 bg-gray-950/40 p-3 text-sm text-gray-400">
                  Sæt din grid locator på profilen for at få live MUF/foF2 for dit QTH.
                </p>
              )}

              {livePropagation.bandRecommendations.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-4">
                  {livePropagation.bandRecommendations.map(band => (
                    <div key={band.band} className={`rounded-md border px-3 py-2 ${band.supported ? 'border-emerald-900 bg-emerald-950/20' : 'border-gray-800 bg-gray-950/40'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-white">{band.band}</p>
                        <Badge variant={band.supported ? 'success' : 'default'}>
                          {band.supported ? 'Under MUF' : 'Over MUF'}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-gray-400">{band.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Seneste QSOer</CardTitle>
            <Link href="/logbook" className="text-sm text-blue-400">Se alle →</Link>
          </CardHeader>
          <CardContent className="p-0">
            {recentQsos.length === 0 ? <p className="px-6 py-4 text-gray-500 text-sm">Ingen QSOer endnu</p> : (
              <div className="divide-y divide-gray-700">
                {recentQsos.map(q => (
                  <div key={q.id} className="px-6 py-3 flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-white">{q.workedCallsign}</span>
                      <span className="text-gray-500 text-xs ml-2">{q.country}</span>
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
            <CardTitle>Seneste DX Spots</CardTitle>
            <Link href="/spots" className="text-sm text-blue-400">Se alle →</Link>
          </CardHeader>
          <CardContent className="p-0">
            {recentSpots.length === 0 ? <p className="px-6 py-4 text-gray-500 text-sm">Ingen spots</p> : (
              <div className="divide-y divide-gray-700">
                {recentSpots.map(s => (
                  <div key={s.id} className="px-6 py-3 flex items-center justify-between">
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

function formatNumber(value: number | null | undefined, suffix = '', digits = 0) {
  if (value == null || Number.isNaN(value)) return 'Ukendt'
  return `${value.toLocaleString('da-DK', { maximumFractionDigits: digits, minimumFractionDigits: digits })}${suffix}`
}
