'use client'
import { useEffect, useState, lazy, Suspense } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'
import { Band, BandLabels, Mode, ModeLabels, type Qso, type QsoConditions, type QsoConditionsLocation, type QsoExternalLogStatus, type QsoMufStation } from '@/lib/types'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useToast } from '@/contexts/ToastContext'
import { gridToLatLng } from '@/components/ui/Map'

const Map = lazy(() => import('@/components/ui/Map'))

export default function EditQsoPage() {
  useRequireAuth()
  const { toast } = useToast()
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [form, setForm] = useState({
    dateUtc: '', ownCallsign: '', workedCallsign: '',
    band: Band.M20, frequency: '', mode: Mode.SSB,
    rstSent: '', rstReceived: '',
    submode: '', locator: '', myGridsquare: '',
    country: '', dxcc: '', continent: '', state: '', iota: '',
    name: '', qth: '', txPower: '', comment: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'details' | 'map' | 'conditions' | 'propagation' | 'qsl'>('details')
  const [externalStatuses, setExternalStatuses] = useState<QsoExternalLogStatus[]>([])
  const [externalLoading, setExternalLoading] = useState(false)
  const [conditions, setConditions] = useState<QsoConditions | null>(null)
  const [conditionsLoading, setConditionsLoading] = useState(false)
  const [conditionsError, setConditionsError] = useState('')

  useEffect(() => {
    if (!id) return
    const qsoId = Number(id)
    let cancelled = false

    api.qsos.getById(qsoId).then((q: Qso) => {
      setForm({
        dateUtc: new Date(q.dateUtc).toISOString().slice(0, 16),
        ownCallsign: q.ownCallsign,
        workedCallsign: q.workedCallsign,
        band: q.band,
        frequency: q.frequency?.toString() ?? '',
        mode: q.mode,
        rstSent: q.rstSent ?? '',
        rstReceived: q.rstReceived ?? '',
        submode: q.submode ?? '',
        locator: q.locator ?? '',
        myGridsquare: q.myGridsquare ?? '',
        country: q.country ?? '',
        dxcc: q.dxcc?.toString() ?? '',
        continent: q.continent ?? '',
        state: q.state ?? '',
        iota: q.iota ?? '',
        name: q.name ?? '',
        qth: q.qth ?? '',
        txPower: q.txPower?.toString() ?? '',
        comment: q.comment ?? '',
      })
    }).catch(() => router.replace('/logbook')).finally(() => setLoading(false))

    async function loadExternalStatus() {
      setExternalLoading(true)
      try {
        const statuses = await api.qsos.getExternalStatus(qsoId)
        if (!cancelled) setExternalStatuses(statuses)
      } catch {
        if (!cancelled) setExternalStatuses([])
      } finally {
        if (!cancelled) setExternalLoading(false)
      }
    }

    loadExternalStatus()
    return () => { cancelled = true }
  }, [id, router])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await api.qsos.update(Number(id), {
        ...form,
        dateUtc: new Date(form.dateUtc).toISOString(),
        frequency: form.frequency ? parseFloat(form.frequency) : undefined,
        dxcc: form.dxcc ? parseInt(form.dxcc) : undefined,
        txPower: form.txPower ? parseFloat(form.txPower) : undefined,
      })
      toast('QSO gemt!')
      router.push('/logbook')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fejl')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="max-w-6xl mx-auto px-4 py-10 text-gray-400">Indlæser...</div>

  const mapMarkers = [
    form.myGridsquare
      ? { grid: form.myGridsquare, label: form.ownCallsign || 'Min station', type: 'Min station' }
      : null,
    form.locator
      ? { grid: form.locator, label: form.workedCallsign || 'Kontakt', type: 'Kontakt' }
      : null,
  ]
    .map(item => {
      if (!item) return null
      const pos = gridToLatLng(item.grid)
      if (!pos) return null
      return {
        ...pos,
        label: item.label,
        popup: `<b>${item.label}</b><br/>${item.type}<br/><span style="font-family: monospace">${item.grid.toUpperCase()}</span>`,
      }
    })
    .filter(Boolean) as { lat: number; lng: number; label: string; popup: string }[]

  const badgeVariant = (status: string) => {
    if (status === 'synced' || status === 'sent') return 'success'
    if (status === 'ready') return 'warning'
    return 'default'
  }

  const refreshExternalStatus = async () => {
    setExternalLoading(true)
    try {
      setExternalStatuses(await api.qsos.getExternalStatus(Number(id)))
      toast('QSL status opdateret')
    } catch {
      toast('Kunne ikke hente QSL status')
    } finally {
      setExternalLoading(false)
    }
  }

  const syncQrz = async () => {
    setExternalLoading(true)
    try {
      await api.qrz.sync()
      setExternalStatuses(await api.qsos.getExternalStatus(Number(id)))
      toast('QRZ synkronisering startet')
    } catch {
      toast('Kunne ikke starte QRZ synkronisering')
    } finally {
      setExternalLoading(false)
    }
  }

  const sendEqsl = async () => {
    setExternalLoading(true)
    try {
      await api.qsos.sendToEqsl(Number(id))
      setExternalStatuses(await api.qsos.getExternalStatus(Number(id)))
      toast('QSO sendt til eQSL')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Kunne ikke sende til eQSL', 'error')
    } finally {
      setExternalLoading(false)
    }
  }

  const handleSendExternal = (provider: string) => {
    if (provider === 'QRZ') return syncQrz()
    if (provider === 'eQSL') return sendEqsl()
  }

  const handleFetchExternal = (provider: string) => {
    if (provider === 'QRZ') return syncQrz()
    if (provider === 'eQSL') return refreshExternalStatus()
  }

  const refreshConditions = async () => {
    setConditionsLoading(true)
    setConditionsError('')
    try {
      setConditions(await api.qsos.getConditions(Number(id)))
    } catch {
      setConditionsError('Kunne ikke hente vejrdata for denne QSO.')
    } finally {
      setConditionsLoading(false)
    }
  }

  const openConditionsTab = () => {
    setActiveTab('conditions')
    if (!conditions && !conditionsLoading) void refreshConditions()
  }

  const openPropagationTab = () => {
    setActiveTab('propagation')
    if (!conditions && !conditionsLoading) void refreshConditions()
  }

  const formatNumber = (value: number | null | undefined, suffix = '', digits = 0) =>
    value == null ? 'Ukendt' : `${value.toFixed(digits)}${suffix}`

  const weatherItems = (location: QsoConditionsLocation) => [
    ['Temperatur', formatNumber(location.weather?.temperatureC, ' C', 1)],
    ['Luftfugtighed', formatNumber(location.weather?.relativeHumidityPercent, '%')],
    ['Tryk', formatNumber(location.weather?.pressureHpa, ' hPa')],
    ['Skydække', formatNumber(location.weather?.cloudCoverPercent, '%')],
    ['Vind', location.weather?.windSpeedKmh == null ? 'Ukendt' : `${formatNumber(location.weather.windSpeedKmh, ' km/t')} fra ${formatNumber(location.weather.windDirectionDegrees, '°')}`],
    ['Nedbør', formatNumber(location.weather?.precipitationMm, ' mm', 1)],
  ]

  const clampPercent = (value: number | null | undefined, max: number) =>
    value == null ? 0 : Math.max(0, Math.min(100, (value / max) * 100))

  const kpTone = (kp: number | null | undefined) => {
    if (kp == null) return 'bg-gray-600'
    if (kp >= 7) return 'bg-red-500'
    if (kp >= 5) return 'bg-orange-500'
    if (kp >= 4) return 'bg-yellow-400'
    return 'bg-emerald-500'
  }

  const bzTone = (bz: number | null | undefined) => {
    if (bz == null) return 'text-gray-400'
    if (bz <= -10) return 'text-red-300'
    if (bz <= -5) return 'text-orange-300'
    if (bz < 0) return 'text-yellow-200'
    return 'text-emerald-300'
  }

  const f107Tone = (f107: number | null | undefined) => {
    if (f107 == null) return 'bg-gray-600'
    if (f107 >= 180) return 'bg-red-500'
    if (f107 >= 140) return 'bg-orange-500'
    if (f107 >= 100) return 'bg-yellow-400'
    return 'bg-sky-500'
  }

  const ratingVariant = (rating: string) => {
    if (rating === 'God') return 'success'
    if (rating === 'Svag') return 'warning'
    return 'info'
  }

  const stationRows: Array<[string, QsoMufStation | null]> = conditions
    ? [
        ['Min station', conditions.propagation.mufFof2.ownNearestStation],
        ['Midtpunkt', conditions.propagation.mufFof2.midpointNearestStation],
        ['Kontakt', conditions.propagation.mufFof2.workedNearestStation],
      ]
    : []

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-white mb-8">Rediger QSO</h1>
      <Card>
        <CardContent className="py-6">
          <div className="mb-6 flex gap-1 rounded-lg border border-gray-700 bg-gray-900/50 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === 'details' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Detaljer
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('map')}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === 'map' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Kort
            </button>
            <button
              type="button"
              onClick={openConditionsTab}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === 'conditions' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Forhold
            </button>
            <button
              type="button"
              onClick={openPropagationTab}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === 'propagation' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Propagation
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('qsl')}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === 'qsl' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              QSL status
            </button>
          </div>

          {activeTab === 'details' ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">

            <div className="grid grid-cols-2 gap-3">
              <Input label="Dato/tid UTC *" type="datetime-local" value={form.dateUtc} onChange={set('dateUtc')} required />
              <Input label="Eget kaldesignal *" value={form.ownCallsign} onChange={set('ownCallsign')} required />
            </div>

            <Input label="Kontaktens kaldesignal *" value={form.workedCallsign} onChange={set('workedCallsign')} required />

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-300">Band</label>
                <select value={form.band} onChange={set('band')} className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white text-sm">
                  {Object.entries(BandLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-300">Mode</label>
                <select value={form.mode} onChange={set('mode')} className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white text-sm">
                  {Object.entries(ModeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <Input label="Submode" value={form.submode} onChange={set('submode')} placeholder="USB, LSB, JT65..." />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Input label="Frekvens (MHz)" type="number" step="0.001" value={form.frequency} onChange={set('frequency')} />
              <Input label="RST Sendt" value={form.rstSent} onChange={set('rstSent')} />
              <Input label="RST Modtaget" value={form.rstReceived} onChange={set('rstReceived')} />
            </div>

            <div className="border-t border-gray-700 pt-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Lokation</p>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Kontaktens Grid Locator" value={form.locator} onChange={set('locator')} placeholder="JO55WM" />
                <Input label="Mit Grid Locator" value={form.myGridsquare} onChange={set('myGridsquare')} placeholder="JO65DQ" />
              </div>
            </div>

            <div className="border-t border-gray-700 pt-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">DX-info</p>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Land" value={form.country} onChange={set('country')} />
                <Input label="DXCC" type="number" value={form.dxcc} onChange={set('dxcc')} placeholder="291" />
              </div>
              <div className="grid grid-cols-3 gap-3 mt-3">
                <Input label="Kontinent" value={form.continent} onChange={set('continent')} placeholder="EU" />
                <Input label="Stat/Provins" value={form.state} onChange={set('state')} placeholder="CA" />
                <Input label="IOTA" value={form.iota} onChange={set('iota')} placeholder="EU-030" />
              </div>
            </div>

            <div className="border-t border-gray-700 pt-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Operatøroplysninger</p>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Navn" value={form.name} onChange={set('name')} />
                <Input label="QTH" value={form.qth} onChange={set('qth')} />
              </div>
              <div className="mt-3">
                <Input label="TX Effekt (W)" type="number" step="0.1" value={form.txPower} onChange={set('txPower')} />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-300">Kommentar</label>
              <textarea rows={2} value={form.comment} onChange={set('comment')} className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white text-sm" />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-3">
              <Button type="submit" disabled={saving}>{saving ? 'Gemmer...' : 'Gem ændringer'}</Button>
              <Button type="button" variant="secondary" onClick={() => router.push('/logbook')}>Annuller</Button>
            </div>
            </form>
          ) : activeTab === 'map' ? (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">QSO placering</h2>
                <p className="mt-1 text-sm text-gray-400">
                  Kortet bruger grid locators fra denne QSO. Udfyld kontaktens og evt. dit eget grid under Detaljer for at se markører her.
                </p>
              </div>

              {mapMarkers.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-gray-700">
                  <Suspense fallback={<div className="flex h-96 items-center justify-center bg-gray-800 text-gray-400">Indlæser kort...</div>}>
                    <Map markers={mapMarkers} height="clamp(420px, calc(100vh - 280px), 760px)" />
                  </Suspense>
                </div>
              ) : (
                <div className="flex min-h-64 items-center justify-center rounded-lg border border-dashed border-gray-700 bg-gray-900/40 px-6 text-center text-sm text-gray-400">
                  Der er ingen gyldige grid locators på denne QSO endnu.
                </div>
              )}
            </div>
          ) : activeTab === 'conditions' ? (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Vejr og radioforhold</h2>
                  <p className="mt-1 text-sm text-gray-400">
                    Viser historisk vejr for begge grid locators ved nærmeste hele UTC-time.
                  </p>
                </div>
                <Button type="button" variant="secondary" onClick={refreshConditions} disabled={conditionsLoading}>
                  {conditionsLoading ? 'Henter...' : 'Opdater forhold'}
                </Button>
              </div>

              {conditionsLoading && !conditions ? (
                <div className="rounded-lg border border-gray-700 bg-gray-900/40 px-4 py-6 text-sm text-gray-400">
                  Henter vejrdata...
                </div>
              ) : conditionsError ? (
                <div className="rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-100">
                  {conditionsError}
                </div>
              ) : conditions ? (
                <>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-lg border border-gray-700 bg-gray-900/30 p-4">
                      <p className="text-xs uppercase tracking-wide text-gray-500">QSO tidspunkt</p>
                      <p className="mt-2 text-sm font-semibold text-white">
                        {new Date(conditions.qsoTimeUtc).toLocaleString('da-DK', { timeZone: 'UTC' })} UTC
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Vejrtime {new Date(conditions.nearestWeatherHourUtc).toLocaleTimeString('da-DK', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' })} UTC
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-700 bg-gray-900/30 p-4">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Afstand</p>
                      <p className="mt-2 text-sm font-semibold text-white">{formatNumber(conditions.distanceKm, ' km', 1)}</p>
                    </div>
                    <div className="rounded-lg border border-gray-700 bg-gray-900/30 p-4">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Retning</p>
                      <p className="mt-2 text-sm font-semibold text-white">{formatNumber(conditions.bearingDegrees, '°')}</p>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    {[conditions.ownLocation, conditions.workedLocation].map(location => location ? (
                      <div key={`${location.role}-${location.grid}`} className="rounded-lg border border-gray-700 bg-gray-900/30 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-gray-500">{location.role}</p>
                            <h3 className="mt-1 text-base font-semibold text-white">{location.callsign}</h3>
                            <p className="mt-1 font-mono text-xs text-gray-500">
                              {location.grid} · {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                            </p>
                          </div>
                          <Badge variant={location.weather ? 'success' : 'default'}>
                            {location.weather ? 'Vejr fundet' : 'Ingen vejrdata'}
                          </Badge>
                        </div>

                        {location.weather ? (
                          <div className="mt-4 grid grid-cols-2 gap-3">
                            {weatherItems(location).map(([label, value]) => (
                              <div key={label} className="rounded-md bg-gray-950/40 px-3 py-2">
                                <p className="text-xs text-gray-500">{label}</p>
                                <p className="mt-1 text-sm font-medium text-white">{value}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-4 text-sm text-gray-400">
                            Der blev ikke fundet historisk vejr for dette grid og tidspunkt.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div key="missing-location" className="rounded-lg border border-dashed border-gray-700 bg-gray-900/30 p-4 text-sm text-gray-400">
                        Mangler en gyldig grid locator for en af stationerne.
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-gray-500">Vejrkilde: {conditions.weatherSource}</p>
                </>
              ) : (
                <div className="rounded-lg border border-gray-700 bg-gray-900/40 px-4 py-6 text-sm text-gray-400">
                  Åbn fanen igen eller tryk Opdater forhold for at hente data.
                </div>
              )}
            </div>
          ) : activeTab === 'propagation' ? (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Propagation</h2>
                  <p className="mt-1 text-sm text-gray-400">
                    Radioforhold for denne QSO: NOAA SWPC, grayline, D-RAP, X-ray, solcyklus og band snapshot.
                  </p>
                </div>
                <Button type="button" variant="secondary" onClick={refreshConditions} disabled={conditionsLoading}>
                  {conditionsLoading ? 'Henter...' : 'Opdater propagation'}
                </Button>
              </div>

              {conditionsLoading && !conditions ? (
                <div className="rounded-lg border border-gray-700 bg-gray-900/40 px-4 py-6 text-sm text-gray-400">
                  Henter propagation-data...
                </div>
              ) : conditionsError ? (
                <div className="rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-100">
                  {conditionsError}
                </div>
              ) : conditions ? (
                <>
                  <div className="rounded-lg border border-blue-900/60 bg-blue-950/30 p-4 text-sm text-blue-100">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-medium text-white">NOAA SWPC radioforhold</p>
                        <p className="mt-1 text-blue-100">{conditions.propagation.status}</p>
                      </div>
                      <Badge variant="info">{conditions.propagation.source}</Badge>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                      <div className="rounded-lg border border-blue-800/50 bg-gray-950/30 p-4">
                        <div className="flex items-end justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-blue-200/70">Geomagnetisk uro</p>
                            <p className="mt-1 text-2xl font-semibold text-white">
                              {conditions.propagation.kpIndex == null ? 'Kp ukendt' : `Kp ${conditions.propagation.kpIndex.toFixed(2)}`}
                            </p>
                          </div>
                          <p className="text-sm font-medium text-blue-100">
                            {conditions.propagation.geomagneticScale ?? 'G?'}
                          </p>
                        </div>
                        <div className="mt-4 h-3 overflow-hidden rounded-full bg-gray-800">
                          <div
                            className={`h-full rounded-full ${kpTone(conditions.propagation.kpIndex)}`}
                            style={{ width: `${clampPercent(conditions.propagation.kpIndex, 9)}%` }}
                          />
                        </div>
                        <div className="mt-2 flex justify-between text-[11px] text-blue-200/60">
                          <span>Rolig</span>
                          <span>Aktiv</span>
                          <span>Storm</span>
                        </div>
                      </div>

                      <div className="rounded-lg border border-blue-800/50 bg-gray-950/30 p-4">
                        <p className="text-xs uppercase tracking-wide text-blue-200/70">NOAA skalaer</p>
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          {[
                            ['G', conditions.propagation.geomagneticScale ?? 'G?'],
                            ['R', conditions.propagation.radioBlackoutScale ?? 'R?'],
                            ['S', conditions.propagation.solarRadiationScale ?? 'S?'],
                          ].map(([label, value]) => (
                            <div key={label} className="rounded-md bg-gray-900/70 px-3 py-2 text-center">
                              <p className="text-[11px] text-blue-200/60">{label}</p>
                              <p className="mt-1 text-base font-semibold text-white">{value}</p>
                            </div>
                          ))}
                        </div>
                        <p className="mt-3 text-xs text-blue-200/70">
                          {conditions.propagation.observedAtUtc
                            ? `${conditions.propagation.minutesFromQso?.toFixed(0) ?? '?'} min fra QSO-tidspunktet`
                            : 'Ingen NOAA timestamp fundet'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div className="rounded-lg border border-blue-800/50 bg-gray-950/30 p-4">
                        <p className="text-xs uppercase tracking-wide text-blue-200/70">GOES X-ray og D-RAP</p>
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <div className="rounded-md bg-gray-900/70 px-3 py-2">
                            <p className="text-xs text-blue-200/60">Flare klasse</p>
                            <p className="mt-1 text-base font-semibold text-white">{conditions.propagation.xrayClass ?? 'Ukendt'}</p>
                          </div>
                          <div className="rounded-md bg-gray-900/70 px-3 py-2">
                            <p className="text-xs text-blue-200/60">X-ray flux</p>
                            <p className="mt-1 text-base font-semibold text-white">{formatNumber(conditions.propagation.xrayFlux, ' W/m2', 8)}</p>
                          </div>
                        </div>
                        <p className="mt-3 text-sm text-blue-100">{conditions.propagation.dRegionAbsorption.impact}</p>
                        <a className="mt-2 inline-block text-xs text-blue-200 underline" href={conditions.propagation.dRegionAbsorption.sourceUrl} target="_blank" rel="noreferrer">
                          Åbn NOAA D-RAP
                        </a>
                      </div>

                      <div className="rounded-lg border border-blue-800/50 bg-gray-950/30 p-4">
                        <p className="text-xs uppercase tracking-wide text-blue-200/70">Solvind</p>
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-blue-200/60">Hastighed</p>
                            <p className="mt-1 text-base font-semibold text-white">{formatNumber(conditions.propagation.solarWindSpeedKms, ' km/s', 1)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-blue-200/60">Densitet</p>
                            <p className="mt-1 text-base font-semibold text-white">{formatNumber(conditions.propagation.solarWindDensity, ' p/cm3', 1)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-blue-200/60">Bz</p>
                            <p className={`mt-1 text-base font-semibold ${bzTone(conditions.propagation.interplanetaryMagneticFieldBz)}`}>
                              {formatNumber(conditions.propagation.interplanetaryMagneticFieldBz, ' nT', 1)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-blue-200/60">Bt</p>
                            <p className="mt-1 text-base font-semibold text-white">{formatNumber(conditions.propagation.interplanetaryMagneticFieldBt, ' nT', 1)}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-lg border border-blue-800/50 bg-gray-950/30 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-blue-200/70">Solcyklus 25</p>
                          <p className="mt-1 text-base font-semibold text-white">
                            {conditions.propagation.solarCyclePhase ?? 'Ukendt fase'}
                          </p>
                        </div>
                        <p className="text-sm font-medium text-blue-100">
                          SSN {formatNumber(conditions.propagation.sunspotNumber)}
                        </p>
                      </div>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div>
                          <div className="flex justify-between text-xs text-blue-200/70">
                            <span>Minimum</span>
                            <span>Peak</span>
                          </div>
                          <div className="mt-2 h-3 overflow-hidden rounded-full bg-gray-800">
                            <div
                              className="h-full rounded-full bg-sky-400"
                              style={{ width: `${conditions.propagation.solarCycleProgressPercent ?? 0}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between text-xs text-blue-200/70">
                            <span>F10.7 solar flux</span>
                            <span>{formatNumber(conditions.propagation.solarFluxIndex, ' sfu')}</span>
                          </div>
                          <div className="mt-2 h-3 overflow-hidden rounded-full bg-gray-800">
                            <div
                              className={`h-full rounded-full ${f107Tone(conditions.propagation.solarFluxIndex)}`}
                              style={{ width: `${clampPercent(conditions.propagation.solarFluxIndex, 220)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="mt-4 text-xs text-blue-200/80">{conditions.propagation.description}</p>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                    <div className="rounded-lg border border-gray-700 bg-gray-900/30 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-gray-500">Grayline og path daylight</p>
                          <h3 className="mt-1 text-base font-semibold text-white">
                            {conditions.propagation.path?.summary ?? 'Path ikke beregnet'}
                          </h3>
                        </div>
                        <Badge variant="info">Path</Badge>
                      </div>
                      {conditions.propagation.path ? (
                        <div className="mt-4 grid gap-3">
                          {[
                            ['Min station', conditions.propagation.path.ownLight, conditions.propagation.path.ownSolarElevationDegrees],
                            ['Midtpunkt', conditions.propagation.path.midpointLight, conditions.propagation.path.midpointSolarElevationDegrees],
                            ['Kontakt', conditions.propagation.path.workedLight, conditions.propagation.path.workedSolarElevationDegrees],
                          ].map(([label, light, elevation]) => (
                            <div key={label} className="flex items-center justify-between rounded-md bg-gray-950/40 px-3 py-2">
                              <div>
                                <p className="text-xs text-gray-500">{label}</p>
                                <p className="text-sm font-medium text-white">{light}</p>
                              </div>
                              <p className="text-sm text-gray-300">{Number(elevation).toFixed(1)}°</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-4 text-sm text-gray-400">Mangler gyldige grid locators for at beregne path daylight.</p>
                      )}
                    </div>

                    <div className="rounded-lg border border-gray-700 bg-gray-900/30 p-4">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Band snapshot</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        {conditions.propagation.bandConditions.map(band => (
                          <div key={band.band} className={`rounded-md border px-3 py-2 ${band.isCurrentQsoBand ? 'border-blue-500 bg-blue-950/40' : 'border-gray-800 bg-gray-950/40'}`}>
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-semibold text-white">{band.band}</p>
                              <Badge variant={ratingVariant(band.rating)}>{band.rating}</Badge>
                            </div>
                            <p className="mt-2 text-xs text-gray-400">{band.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-700 bg-gray-900/30 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500">MUF / foF2</p>
                        <h3 className="mt-1 text-base font-semibold text-white">{conditions.propagation.mufFof2.status}</h3>
                        <p className="mt-1 text-sm text-gray-400">{conditions.propagation.mufFof2.description}</p>
                      </div>
                      <a className="text-sm text-blue-300 underline" href={conditions.propagation.mufFof2.sourceUrl} target="_blank" rel="noreferrer">
                        Åbn KC2G
                      </a>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-3">
                      {stationRows.map(([label, station]) => (
                        <div key={label} className="rounded-md border border-gray-800 bg-gray-950/40 p-3">
                          <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
                          {station ? (
                            <>
                              <p className="mt-1 text-sm font-semibold text-white">{station.name}</p>
                              <p className="mt-1 text-xs text-gray-500">{formatNumber(station.distanceKm, ' km')} fra referencepunkt</p>
                              <div className="mt-3 grid grid-cols-2 gap-2">
                                <div>
                                  <p className="text-xs text-gray-500">foF2</p>
                                  <p className="text-sm font-medium text-white">{formatNumber(station.fof2Mhz, ' MHz', 1)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">MUF(3000)</p>
                                  <p className="text-sm font-medium text-white">{formatNumber(station.muf3000Mhz, ' MHz', 1)}</p>
                                </div>
                              </div>
                              <p className="mt-2 text-xs text-gray-500">
                                {station.observedAtUtc
                                  ? `${new Date(station.observedAtUtc).toLocaleTimeString('da-DK', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' })} UTC`
                                  : 'Tid ukendt'}
                                {station.confidencePercent != null ? ` · ${station.confidencePercent.toFixed(0)}% confidence` : ''}
                              </p>
                            </>
                          ) : (
                            <p className="mt-3 text-sm text-gray-400">Ingen nær station fundet.</p>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-4">
                      {conditions.propagation.mufFof2.bandRecommendations.map(band => (
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
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-gray-700 bg-gray-900/40 px-4 py-6 text-sm text-gray-400">
                  Åbn fanen igen eller tryk Opdater propagation for at hente data.
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Eksterne logbøger</h2>
                  <p className="mt-1 text-sm text-gray-400">
                    Se om denne QSO er registreret hos eksterne logtjenester. QRZ bruger den eksisterende HamHub-synkronisering.
                  </p>
                </div>
                <Button type="button" variant="secondary" onClick={refreshExternalStatus} disabled={externalLoading}>
                  {externalLoading ? 'Opdaterer...' : 'Opdater status'}
                </Button>
              </div>

              {externalLoading && externalStatuses.length === 0 ? (
                <div className="rounded-lg border border-gray-700 bg-gray-900/40 px-4 py-6 text-sm text-gray-400">
                  Henter QSL status...
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-gray-700">
                  <div className="divide-y divide-gray-700">
                    {externalStatuses.map(status => (
                      <div key={status.provider} className="grid gap-4 bg-gray-900/30 p-4 md:grid-cols-[160px_1fr_auto] md:items-center">
                        <div>
                          <p className="text-sm font-semibold text-white">{status.provider}</p>
                          {status.externalId && (
                            <p className="mt-1 font-mono text-xs text-gray-500">ID {status.externalId}</p>
                          )}
                        </div>
                        <div>
                          <Badge variant={badgeVariant(status.status)}>{status.label}</Badge>
                          <p className="mt-2 text-sm text-gray-400">{status.description}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 md:justify-end">
                          {status.status === 'not-configured' && status.provider === 'eQSL' ? (
                            <Button type="button" size="sm" variant="secondary" onClick={() => router.push('/profile')}>
                              Opsæt eQSL
                            </Button>
                          ) : (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleSendExternal(status.provider)}
                                disabled={!status.canSend || externalLoading}
                              >
                                Send
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() => handleFetchExternal(status.provider)}
                                disabled={!status.canFetch || externalLoading}
                              >
                                Hent
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                    {externalStatuses.length === 0 && (
                      <div className="bg-gray-900/30 p-4 text-sm text-gray-400">
                        Ingen ekstern status fundet for denne QSO.
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-blue-900/60 bg-blue-950/30 px-4 py-3 text-sm text-blue-100">
                eQSL kan bruges når login er gemt under Min Profil. LoTW kræver stadig TQSL/signering og er derfor ikke aktiv endnu.
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
