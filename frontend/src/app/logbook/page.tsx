'use client'
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Band, BandLabels, Mode, ModeLabels, type Qso } from '@/lib/types'
import { formatUtcDate } from '@/lib/utils'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useToast } from '@/contexts/ToastContext'
import { buildQsoAwardLabels, type QsoAwardLabelTone } from './awardLabels'
import { eqslTitle, eqslTone, lotwTitle, lotwTone, qrzTitle, qrzTone, type QslBadgeTone } from './qslBadges'
import { pageShellClass } from '@/lib/layout'
import { useLanguage } from '@/i18n/LanguageContext'
import { gridToLatLng, type MapMarker } from '@/components/ui/Map'

const PAGE_SIZE = 25
const Map = lazy(() => import('@/components/ui/Map'))
type LogbookTab = 'list' | 'map'

const BAND_ADIF: Record<Band, string> = {
  [Band.M160]: '160M', [Band.M80]: '80M', [Band.M60]: '60M', [Band.M40]: '40M',
  [Band.M30]: '30M', [Band.M20]: '20M', [Band.M17]: '17M', [Band.M15]: '15M',
  [Band.M12]: '12M', [Band.M10]: '10M', [Band.M6]: '6M', [Band.M2]: '2M', [Band.CM70]: '70CM'
}
const MODE_ADIF: Record<Mode, string> = {
  [Mode.SSB]: 'SSB', [Mode.CW]: 'CW', [Mode.FT8]: 'FT8', [Mode.FT4]: 'FT4',
  [Mode.RTTY]: 'RTTY', [Mode.DMR]: 'DMR', [Mode.FM]: 'FM', [Mode.AM]: 'AM'
}

function exportAdif(qsos: Qso[]) {
  const field = (name: string, value: string) => `<${name}:${value.length}>${value}`
  const lines = ['<ADIF_VER:5>3.1.4', '<PROGRAMID:6>HamHub', '<EOH>']
  for (const q of qsos) {
    const d = new Date(q.dateUtc)
    const date = d.toISOString().slice(0, 10).replace(/-/g, '')
    const time = d.toISOString().slice(11, 16).replace(':', '')
    const rec = [
      field('CALL', q.workedCallsign),
      field('BAND', BAND_ADIF[q.band]),
      field('MODE', MODE_ADIF[q.mode]),
      field('QSO_DATE', date),
      field('TIME_ON', time),
      q.rstSent ? field('RST_SENT', q.rstSent) : '',
      q.rstReceived ? field('RST_RCVD', q.rstReceived) : '',
      q.country ? field('COUNTRY', q.country) : '',
      q.dxcc ? field('DXCC', q.dxcc.toString()) : '',
      q.continent ? field('CONT', q.continent) : '',
      q.state ? field('STATE', q.state) : '',
      q.cqZone ? field('CQZ', q.cqZone.toString()) : '',
      q.ituZone ? field('ITUZ', q.ituZone.toString()) : '',
      q.county ? field('CNTY', q.county) : '',
      q.myState ? field('MY_STATE', q.myState) : '',
      q.myCounty ? field('MY_CNTY', q.myCounty) : '',
      q.iota ? field('IOTA', q.iota) : '',
      q.potaRefs ? field('POTA_REF', q.potaRefs) : '',
      q.sotaRefs ? field('SOTA_REF', q.sotaRefs) : '',
      q.awardRefs ? field('AWARD_SUBMITTED', q.awardRefs) : '',
      q.locator ? field('GRIDSQUARE', q.locator) : '',
      q.myGridsquare ? field('MY_GRIDSQUARE', q.myGridsquare) : '',
      q.frequency ? field('FREQ', q.frequency.toFixed(3)) : '',
      q.comment ? field('COMMENT', q.comment) : '',
      '<EOR>',
    ].filter(Boolean).join('')
    lines.push(rec)
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `hamhub-logbog-${new Date().toISOString().slice(0, 10)}.adi`
  a.click()
  URL.revokeObjectURL(a.href)
}

function QslStatusBadge({ label, tone, title }: { label: string; tone: QslBadgeTone; title: string }) {
  const classes: Record<QslBadgeTone, string> = {
    confirmed: 'border-green-700/60 bg-green-950/40 text-green-200',
    pending: 'border-yellow-700/60 bg-yellow-950/40 text-yellow-200',
    missing: 'border-red-800/60 bg-red-950/30 text-red-200',
  }

  return (
    <span title={title} className={`inline-flex min-w-12 items-center justify-center rounded border px-2 py-0.5 text-[11px] font-semibold ${classes[tone]}`}>
      {label}
    </span>
  )
}

function AwardLabelBadge({ text, tone, title }: { text: string; tone: QsoAwardLabelTone; title: string }) {
  const classes: Record<QsoAwardLabelTone, string> = {
    dxcc: 'border-cyan-800/70 bg-cyan-950/40 text-cyan-100',
    zone: 'border-blue-800/70 bg-blue-950/40 text-blue-100',
    reference: 'border-violet-800/70 bg-violet-950/40 text-violet-100',
    county: 'border-slate-700 bg-slate-900/70 text-slate-100',
  }

  return (
    <span title={title} className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold ${classes[tone]}`}>
      {text}
    </span>
  )
}

export default function LogbookPage() {
  useRequireAuth()
  const { toast } = useToast()
  const { t } = useLanguage()
  const router = useRouter()
  const [qsos, setQsos] = useState<Qso[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [activeTab, setActiveTab] = useState<LogbookTab>('list')
  const [qrzSyncing, setQrzSyncing] = useState(false)
  const [lotwSyncing, setLotwSyncing] = useState(false)

  const qsoMapMarkers = useMemo<MapMarker[]>(() => qsos.flatMap(q => {
    const position = gridToLatLng(q.locator)
    if (!position) return []
    const bandMode = `${BandLabels[q.band]} / ${ModeLabels[q.mode]}`
    const grid = q.locator?.toUpperCase()
    return [{
      id: String(q.id),
      lat: position.lat,
      lng: position.lng,
      label: q.workedCallsign,
      tooltip: `${q.workedCallsign} - ${grid} - ${bandMode}`,
      popup: [
        `<b>${q.workedCallsign}</b>`,
        `${formatUtcDate(q.dateUtc)}`,
        `${bandMode}`,
        grid ? `<span style="font-family: monospace">${grid}</span>` : '',
        q.country ? `${q.country}` : '',
      ].filter(Boolean).join('<br/>'),
      variant: 'worked',
      actionLabel: t('common.open'),
    }]
  }), [qsos, t])

  const qsosMissingGrid = qsos.length - qsoMapMarkers.length

  const handleMapMarkerAction = useCallback((marker: MapMarker) => {
    if (marker.id) router.push(`/logbook/${marker.id}`)
  }, [router])

  const load = (s?: string) => {
    setLoading(true)
    setPage(1)
    api.qsos.getMine(s).then(setQsos).finally(() => setLoading(false))
  }

  useEffect(() => {
    let cancelled = false
    api.qsos.getMine()
      .then(items => {
        if (!cancelled) setQsos(items)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const result = await api.qsos.importAdif(file)
      toast(t('logbook.imported', {
        imported: result.imported,
        merged: result.merged ? t('logbook.importMerged', { count: result.merged }) : '',
        skipped: result.skipped ? t('logbook.importSkipped', { count: result.skipped }) : '',
      }))
      load()
    } catch (err) {
      toast(err instanceof Error ? err.message : t('logbook.importFailed'), 'error')
    }
    e.target.value = ''
  }

  const handleQrzSync = async () => {
    setQrzSyncing(true)
    try {
      await api.qrz.sync()
      toast(t('logbook.qrzSyncStarted'))
      await new Promise(r => setTimeout(r, 3000))
      load(search)
    } catch (err) {
      toast(err instanceof Error ? err.message : t('logbook.syncFailed'), 'error')
    } finally {
      setQrzSyncing(false)
    }
  }

  const handleLotwSync = async () => {
    setLotwSyncing(true)
    try {
      const result = await api.lotw.sync()
      toast(t('logbook.lotwSyncComplete', {
        confirmed: result.confirmed,
        checkedNotFound: result.checkedNotFound,
        unmatched: result.unmatched,
      }))
      load(search)
    } catch (err) {
      toast(err instanceof Error ? err.message : t('logbook.lotwSyncFailed'), 'error')
    } finally {
      setLotwSyncing(false)
    }
  }

  return (
    <div className={pageShellClass}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">{t('logbook.title')}</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleQrzSync} disabled={qrzSyncing}>
            {qrzSyncing ? t('common.syncing') : 'QRZ Sync'}
          </Button>
          <Link href="/logbook/qrz-reconciliation"><Button variant="secondary">{t('logbook.qrzReconciliation')}</Button></Link>
          <Button variant="secondary" onClick={handleLotwSync} disabled={lotwSyncing}>
            {lotwSyncing ? t('common.syncing') : 'LoTW Sync'}
          </Button>
          <Link href="/logbook/duplicates"><Button variant="secondary">{t('logbook.duplicates')}</Button></Link>
          {qsos.length > 0 && <Button variant="secondary" onClick={() => exportAdif(qsos)}>{t('logbook.exportAdif')}</Button>}
          <label className="cursor-pointer">
            <Button variant="secondary" type="button" onClick={() => document.getElementById('adif-import')?.click()}>{t('logbook.importAdif')}</Button>
            <input id="adif-import" type="file" accept=".adi,.adif" className="hidden" onChange={handleImport} />
          </label>
          <Link href="/logbook/new"><Button>+ {t('logbook.newQso')}</Button></Link>
        </div>
      </div>
      <div className="flex gap-3 mb-6">
        <Input className="max-w-sm" placeholder={t('logbook.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load(search)} />
        <Button variant="secondary" onClick={() => load(search)}>{t('common.search')}</Button>
        {search && <Button variant="ghost" onClick={() => { setSearch(''); load() }}>{t('logbook.clear')}</Button>}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border border-gray-800 bg-gray-950 p-1">
          {(['list', 'map'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded px-4 py-2 text-sm font-semibold transition-colors ${activeTab === tab ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}
            >
              {tab === 'list' ? t('logbook.tabs.list') : t('logbook.tabs.map')}
            </button>
          ))}
        </div>
        {activeTab === 'map' && (
          <p className="text-sm text-gray-400">
            {t('logbook.map.summary', { mapped: qsoMapMarkers.length, total: qsos.length })}
            {qsosMissingGrid > 0 ? ` - ${t('logbook.map.missingGrid', { count: qsosMissingGrid })}` : ''}
          </p>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? <p className="p-6 text-gray-400">{t('logbook.loading')}</p> : activeTab === 'map' ? (
            <div className="p-4">
              {qsoMapMarkers.length > 0 ? (
                <Suspense fallback={<p className="p-6 text-gray-400">{t('logbook.map.loading')}</p>}>
                  <Map markers={qsoMapMarkers} height="68vh" onMarkerAction={handleMapMarkerAction} />
                </Suspense>
              ) : (
                <div className="border border-gray-800 bg-gray-900 px-4 py-8 text-sm text-gray-400">
                  {t('logbook.map.empty')}
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-800/50">
                  <tr>
                    {[t('qso.dateTimeUtc'), t('qso.ownCallsign'), t('qso.contact'), t('qso.band'), t('qso.mode'), t('qso.rstSr'), t('qso.country'), 'Awards', 'QSL'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-gray-400 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {qsos.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(q => (
                    <tr
                      key={q.id}
                      className="hover:bg-gray-800/50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/logbook/${q.id}`)}
                    >
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{formatUtcDate(q.dateUtc)}</td>
                      <td className="px-4 py-3 font-mono text-gray-300">{q.ownCallsign}</td>
                      <td className="px-4 py-3 font-mono font-bold text-white">{q.workedCallsign}</td>
                      <td className="px-4 py-3"><Badge variant="info">{BandLabels[q.band]}</Badge></td>
                      <td className="px-4 py-3"><Badge>{ModeLabels[q.mode]}</Badge></td>
                      <td className="px-4 py-3 text-gray-400">{q.rstSent}/{q.rstReceived}</td>
                      <td className="px-4 py-3 text-gray-400">{q.country || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex max-w-xs flex-wrap gap-1.5">
                          {buildQsoAwardLabels(q).length > 0 ? buildQsoAwardLabels(q).map(label => (
                            <AwardLabelBadge key={label.key} text={label.text} title={label.title} tone={label.tone} />
                          )) : <span className="text-gray-600">-</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <QslStatusBadge
                            label="QRZ"
                            tone={qrzTone(q)}
                            title={qrzTitle(q, {
                              confirmed: t('qsl.qrzConfirmed'),
                              pending: t('qsl.qrzPending'),
                              missing: t('qsl.qrzMissing'),
                            })}
                          />
                          <QslStatusBadge
                            label="eQSL"
                            tone={eqslTone(q)}
                            title={eqslTitle(q, {
                              confirmed: t('qsl.eqslConfirmed'),
                              pending: t('qsl.eqslPending'),
                              checkedUnconfirmed: t('qsl.eqslCheckedUnconfirmed'),
                              verifyFailed: t('qsl.eqslVerifyFailed'),
                              ready: t('qsl.eqslReady'),
                            })}
                          />
                          <QslStatusBadge
                            label="LoTW"
                            tone={lotwTone(q)}
                            title={lotwTitle(q, {
                              confirmed: t('qsl.lotwConfirmed'),
                              pending: t('qsl.lotwReady'),
                              checkedUnconfirmed: t('qsl.lotwCheckedUnconfirmed'),
                              verifyFailed: t('qsl.lotwVerifyFailed'),
                              ready: t('qsl.lotwReady'),
                            })}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {qsos.length === 0 && <p className="p-6 text-gray-400">{t('logbook.empty')} <Link href="/logbook/new" className="text-blue-400">{t('logbook.logFirst')}</Link></p>}
            </div>
          )}
        </CardContent>
      </Card>
      <div className="flex items-center justify-between mt-3">
        <p className="text-gray-500 text-sm">{t('logbook.count', { count: qsos.length })}</p>
        {qsos.length > PAGE_SIZE && (
          <div className="flex gap-2 items-center">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 text-sm rounded bg-gray-700 text-gray-300 disabled:opacity-40">←</button>
            <span className="text-gray-400 text-sm">{t('logbook.page', { page, total: Math.ceil(qsos.length / PAGE_SIZE) })}</span>
            <button onClick={() => setPage(p => Math.min(Math.ceil(qsos.length / PAGE_SIZE), p + 1))} disabled={page >= Math.ceil(qsos.length / PAGE_SIZE)} className="px-3 py-1 text-sm rounded bg-gray-700 text-gray-300 disabled:opacity-40">→</button>
          </div>
        )}
      </div>
    </div>
  )
}
