'use client'
import { useEffect, useState } from 'react'
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
import { lotwTitle, lotwTone, type QslBadgeTone } from './qslBadges'

const PAGE_SIZE = 25

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
      q.locator ? field('GRIDSQUARE', q.locator) : '',
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

function qrzTone(qso: Qso): QslBadgeTone {
  if (qso.qrzConfirmedAt || qso.qrzConfirmationStatus?.toUpperCase() === 'C') return 'confirmed'
  if (qso.qrzId) return 'pending'
  return 'missing'
}

function qrzTitle(qso: Qso) {
  if (qrzTone(qso) === 'confirmed') return 'QRZ bekræftet af modparten'
  if (qso.qrzId) return 'QRZ registreret, men ikke bekræftet endnu'
  return 'QRZ mangler eller er ikke synkroniseret'
}

function eqslTone(qso: Qso): QslBadgeTone {
  if (qso.eqslConfirmedAt) return 'confirmed'
  if (qso.eqslSentAt) return 'pending'
  if (qso.eqslLastResult?.startsWith('eQSL status opdateret:')) return 'missing'
  if (qso.eqslLastResult?.startsWith('Kunne ikke opdatere eQSL status:')) return 'missing'
  return 'pending'
}

function eqslTitle(qso: Qso) {
  if (qso.eqslConfirmedAt) return 'eQSL bekræftet af modparten'
  if (qso.eqslSentAt) return 'eQSL sendt, men ikke bekræftet endnu'
  if (qso.eqslLastResult?.startsWith('eQSL status opdateret:')) return 'eQSL tjekket, men QSO er ikke fundet endnu'
  if (qso.eqslLastResult?.startsWith('Kunne ikke opdatere eQSL status:')) return 'eQSL status kunne ikke verificeres'
  return 'eQSL er klar eller ikke tjekket endnu'
}

export default function LogbookPage() {
  useRequireAuth()
  const { toast } = useToast()
  const router = useRouter()
  const [qsos, setQsos] = useState<Qso[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [qrzSyncing, setQrzSyncing] = useState(false)

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
      toast(`Importeret: ${result.imported} QSOer${result.skipped ? `, ${result.skipped} sprunget over` : ''}`)
      load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Import mislykkedes', 'error')
    }
    e.target.value = ''
  }

  const handleQrzSync = async () => {
    setQrzSyncing(true)
    try {
      await api.qrz.sync()
      toast('QRZ synkronisering startet...')
      await new Promise(r => setTimeout(r, 3000))
      load(search)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Synkronisering mislykkedes', 'error')
    } finally {
      setQrzSyncing(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">QSO Logbog</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleQrzSync} disabled={qrzSyncing}>
            {qrzSyncing ? 'Synkroniserer...' : 'QRZ Sync'}
          </Button>
          {qsos.length > 0 && <Button variant="secondary" onClick={() => exportAdif(qsos)}>Eksporter ADIF</Button>}
          <label className="cursor-pointer">
            <Button variant="secondary" type="button" onClick={() => document.getElementById('adif-import')?.click()}>Importer ADIF</Button>
            <input id="adif-import" type="file" accept=".adi,.adif" className="hidden" onChange={handleImport} />
          </label>
          <Link href="/logbook/new"><Button>+ Ny QSO</Button></Link>
        </div>
      </div>
      <div className="flex gap-3 mb-6">
        <Input className="max-w-sm" placeholder="Søg kaldesignal..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load(search)} />
        <Button variant="secondary" onClick={() => load(search)}>Søg</Button>
        {search && <Button variant="ghost" onClick={() => { setSearch(''); load() }}>Ryd</Button>}
      </div>
      <Card>
        <CardContent className="p-0">
          {loading ? <p className="p-6 text-gray-400">Indlæser...</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-800/50">
                  <tr>
                    {['Dato/tid (UTC)', 'Eget kald', 'Kontakt', 'Band', 'Mode', 'RST S/R', 'Land', 'QSL'].map(h => (
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
                        <div className="flex flex-wrap gap-1.5">
                          <QslStatusBadge label="QRZ" tone={qrzTone(q)} title={qrzTitle(q)} />
                          <QslStatusBadge label="eQSL" tone={eqslTone(q)} title={eqslTitle(q)} />
                          <QslStatusBadge label="LoTW" tone={lotwTone(q)} title={lotwTitle(q)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {qsos.length === 0 && <p className="p-6 text-gray-400">Ingen QSOer. <Link href="/logbook/new" className="text-blue-400">Log din første QSO →</Link></p>}
            </div>
          )}
        </CardContent>
      </Card>
      <div className="flex items-center justify-between mt-3">
        <p className="text-gray-500 text-sm">{qsos.length} QSOer</p>
        {qsos.length > PAGE_SIZE && (
          <div className="flex gap-2 items-center">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 text-sm rounded bg-gray-700 text-gray-300 disabled:opacity-40">←</button>
            <span className="text-gray-400 text-sm">Side {page} / {Math.ceil(qsos.length / PAGE_SIZE)}</span>
            <button onClick={() => setPage(p => Math.min(Math.ceil(qsos.length / PAGE_SIZE), p + 1))} disabled={page >= Math.ceil(qsos.length / PAGE_SIZE)} className="px-3 py-1 text-sm rounded bg-gray-700 text-gray-300 disabled:opacity-40">→</button>
          </div>
        )}
      </div>
    </div>
  )
}
