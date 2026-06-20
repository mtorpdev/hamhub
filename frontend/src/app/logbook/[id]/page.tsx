'use client'
import { useEffect, useState, lazy, Suspense } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'
import { Band, BandLabels, Mode, ModeLabels, type Qso, type QsoConditions, type QsoConditionsLocation, type QsoExternalLogStatus, type Station } from '@/lib/types'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useToast } from '@/contexts/ToastContext'
import { gridToLatLng } from '@/components/ui/Map'
import { externalActionLabel, externalLastResult, externalPrimaryAction, externalStatusDescription, externalStatusLabel } from '../qsoExternalActions'
import { pageShellClass } from '@/lib/layout'
import { stationById, stationGrid, stationOptionLabel } from '../stationGrid'
import { useLanguage } from '@/i18n/LanguageContext'
import { dateTimeLocalUtcToIso, toUtcDateTimeLocal } from '@/lib/utcDate'

const Map = lazy(() => import('@/components/ui/Map'))
const PROPAGATION_RATING_GOOD = 'G' + 'od'
const PROPAGATION_RATING_WEAK = 'S' + 'vag'

export default function EditQsoPage() {
  useRequireAuth()
  const { toast } = useToast()
  const { t, language } = useLanguage()
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [form, setForm] = useState({
    dateUtc: '', ownCallsign: '', workedCallsign: '',
    band: Band.M20, frequency: '', mode: Mode.SSB,
    rstSent: '', rstReceived: '', stationId: '',
    submode: '', locator: '', myGridsquare: '',
    country: '', dxcc: '', continent: '', state: '', cqZone: '', ituZone: '', county: '',
    myState: '', myCounty: '', iota: '', potaRefs: '', sotaRefs: '', awardRefs: '',
    name: '', qth: '', txPower: '', comment: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'details' | 'map' | 'conditions' | 'propagation' | 'qsl'>('details')
  const [externalStatuses, setExternalStatuses] = useState<QsoExternalLogStatus[]>([])
  const [externalLoading, setExternalLoading] = useState(false)
  const [conditions, setConditions] = useState<QsoConditions | null>(null)
  const [conditionsLoading, setConditionsLoading] = useState(false)
  const [conditionsError, setConditionsError] = useState('')
  const [stations, setStations] = useState<Station[]>([])

  const applyQsoToForm = (q: Qso) => {
    setForm({
      dateUtc: toUtcDateTimeLocal(q.dateUtc),
      ownCallsign: q.ownCallsign,
      workedCallsign: q.workedCallsign,
      band: q.band,
      frequency: q.frequency?.toString() ?? '',
      mode: q.mode,
      rstSent: q.rstSent ?? '',
      stationId: '',
      rstReceived: q.rstReceived ?? '',
      submode: q.submode ?? '',
      locator: q.locator ?? '',
      myGridsquare: q.myGridsquare ?? '',
      country: q.country ?? '',
      dxcc: q.dxcc?.toString() ?? '',
      continent: q.continent ?? '',
      state: q.state ?? '',
      cqZone: q.cqZone?.toString() ?? '',
      ituZone: q.ituZone?.toString() ?? '',
      county: q.county ?? '',
      myState: q.myState ?? '',
      myCounty: q.myCounty ?? '',
      iota: q.iota ?? '',
      potaRefs: q.potaRefs ?? '',
      sotaRefs: q.sotaRefs ?? '',
      awardRefs: q.awardRefs ?? '',
      name: q.name ?? '',
      qth: q.qth ?? '',
      txPower: q.txPower?.toString() ?? '',
      comment: q.comment ?? '',
    })
  }

  useEffect(() => {
    if (!id) return
    const qsoId = Number(id)
    let cancelled = false

    api.qsos.getById(qsoId).then(applyQsoToForm).catch(() => router.replace('/logbook')).finally(() => setLoading(false))
    api.stations.getMine().then(items => {
      if (!cancelled) setStations(items)
    }).catch(() => {})

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

  const setStation = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const station = stationById(stations, e.target.value)
    setForm(f => ({
      ...f,
      stationId: e.target.value,
      myGridsquare: stationGrid(station),
      ownCallsign: station?.callsign || f.ownCallsign,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const { stationId, ...payload } = form
      void stationId
      await api.qsos.update(Number(id), {
        ...payload,
        dateUtc: dateTimeLocalUtcToIso(form.dateUtc),
        frequency: form.frequency ? parseFloat(form.frequency) : undefined,
        dxcc: form.dxcc ? parseInt(form.dxcc) : undefined,
        cqZone: form.cqZone ? parseInt(form.cqZone) : undefined,
        ituZone: form.ituZone ? parseInt(form.ituZone) : undefined,
        txPower: form.txPower ? parseFloat(form.txPower) : undefined,
      })
      toast(t('logbook.detail.savedToast'))
      router.push('/logbook')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('qso.error'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(t('logbook.detail.deleteConfirm'))) return
    setDeleting(true)
    try {
      await api.qsos.delete(Number(id))
      toast(t('logbook.detail.deletedToast'))
      router.push('/logbook')
    } catch {
      toast(t('logbook.detail.deleteFailed'), 'error')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <div className={`${pageShellClass} text-gray-400`}>{t('common.loading')}</div>

  const mapMarkers = [
    form.myGridsquare
      ? { grid: form.myGridsquare, label: form.ownCallsign || t('logbook.detail.myStation'), type: t('logbook.detail.myStation') }
      : null,
    form.locator
      ? { grid: form.locator, label: form.workedCallsign || t('qso.contact'), type: t('qso.contact') }
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
    if (status === 'synced' || status === 'sent' || status === 'confirmed') return 'success'
    if (status === 'ready' || status === 'missing') return 'warning'
    return 'default'
  }

  const providerTone = (status: QsoExternalLogStatus) => {
    if (status.status === 'synced' || status.status === 'sent' || status.status === 'confirmed') return 'border-green-700/60 bg-green-950/20'
    if (status.status === 'ready' || status.status === 'missing') return 'border-yellow-700/60 bg-yellow-950/20'
    return 'border-gray-700 bg-gray-900/30'
  }

  const refreshExternalStatus = async () => {
    setExternalLoading(true)
    try {
      setExternalStatuses(await api.qsos.getExternalStatus(Number(id)))
      toast(t('logbook.detail.qslStatusUpdated'))
    } catch {
      toast(t('logbook.detail.qslStatusFailed'), 'error')
    } finally {
      setExternalLoading(false)
    }
  }

  const syncQrz = async () => {
    setExternalLoading(true)
    try {
      await api.qrz.sync()
      setExternalStatuses(await api.qsos.getExternalStatus(Number(id)))
      toast(t('logbook.qrzSyncStarted'))
    } catch {
      toast(t('logbook.syncFailed'), 'error')
    } finally {
      setExternalLoading(false)
    }
  }

  const sendEqsl = async () => {
    setExternalLoading(true)
    try {
      await api.qsos.sendToEqsl(Number(id))
      setExternalStatuses(await api.qsos.getExternalStatus(Number(id)))
      toast(t('logbook.detail.eqslSent'))
    } catch (err) {
      toast(err instanceof Error ? err.message : t('logbook.detail.eqslSendFailed'), 'error')
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
    if (provider === 'LoTW') return syncLotw()
    if (provider === 'eQSL') return refreshExternalStatus()
  }

  const syncLotw = async () => {
    setExternalLoading(true)
    try {
      const result = await api.lotw.sync()
      const qsoId = Number(id)
      const [qso, statuses] = await Promise.all([
        api.qsos.getById(qsoId),
        api.qsos.getExternalStatus(qsoId),
      ])
      applyQsoToForm(qso)
      setExternalStatuses(statuses)
      toast(t('logbook.lotwSyncComplete', {
        confirmed: result.confirmed,
        checkedNotFound: result.checkedNotFound,
        unmatched: result.unmatched,
      }))
    } catch (err) {
      toast(err instanceof Error ? err.message : t('logbook.lotwSyncFailed'), 'error')
    } finally {
      setExternalLoading(false)
    }
  }

  const handleSetupExternal = (provider: string) => {
    if (provider === 'LoTW') {
      toast(t('logbook.detail.lotwAgentRequired'))
      return
    }
    router.push('/profile')
  }

  const refreshConditions = async () => {
    setConditionsLoading(true)
    setConditionsError('')
    try {
      setConditions(await api.qsos.getConditions(Number(id)))
    } catch {
      setConditionsError(t('logbook.detail.weatherFailed'))
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
    value == null ? t('common.unknown') : `${value.toFixed(digits)}${suffix}`

  const weatherItems = (location: QsoConditionsLocation) => [
    [t('logbook.detail.temperature'), formatNumber(location.weather?.temperatureC, ' C', 1)],
    [t('logbook.detail.humidity'), formatNumber(location.weather?.relativeHumidityPercent, '%')],
    [t('logbook.detail.pressure'), formatNumber(location.weather?.pressureHpa, ' hPa')],
    [t('logbook.detail.cloudCover'), formatNumber(location.weather?.cloudCoverPercent, '%')],
    [t('logbook.detail.wind'), location.weather?.windSpeedKmh == null ? t('common.unknown') : t('logbook.detail.windFrom', { speed: formatNumber(location.weather.windSpeedKmh, ' km/t'), direction: formatNumber(location.weather.windDirectionDegrees, ' deg') })],
    [t('logbook.detail.precipitation'), formatNumber(location.weather?.precipitationMm, ' mm', 1)],
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
    if (rating === PROPAGATION_RATING_GOOD) return 'success'
    if (rating === PROPAGATION_RATING_WEAK) return 'warning'
    return 'info'
  }

  const propagationDescriptionText = () => {
    const propagation = conditions?.propagation
    if (!propagation) return ''
    const kpText = propagation.kpIndex == null ? t('logbook.detail.kpUnknown') : `Kp ${formatNumber(propagation.kpIndex, '', 2)}`
    const scaleText = propagation.geomagneticScale || t('logbook.detail.gScaleUnknown')
    const statusText = !propagation.observedAtUtc
      ? t('dashboard.propagation.status.unavailable')
      : t('logbook.detail.noaaStatusAvailable')
    const timing = propagation.minutesFromQso == null
      ? t('logbook.detail.noaaNoNearbyTimestamp')
      : t('logbook.detail.noaaTiming', { minutes: formatNumber(propagation.minutesFromQso) })
    return t('logbook.detail.noaaDescription', { kp: kpText, scale: scaleText, status: statusText, timing })
  }

  const noaaStatusText = () => {
    const propagation = conditions?.propagation
    if (!propagation?.observedAtUtc) return t('dashboard.propagation.status.unavailable')
    if (propagation.kpIndex == null && !propagation.geomagneticScale) return t('common.unknown')
    if ((propagation.kpIndex ?? 0) >= 9) return t('logbook.detail.noaaStatusExtremeStorm')
    if ((propagation.kpIndex ?? 0) >= 8) return t('logbook.detail.noaaStatusSevereStorm')
    if ((propagation.kpIndex ?? 0) >= 7) return t('logbook.detail.noaaStatusStrongStorm')
    if ((propagation.kpIndex ?? 0) >= 6) return t('logbook.detail.noaaStatusModerateStorm')
    if ((propagation.kpIndex ?? 0) >= 5 || propagation.geomagneticScale === 'G1') return t('logbook.detail.noaaStatusMinorStorm')
    if ((propagation.kpIndex ?? 0) >= 4) return t('logbook.detail.noaaStatusActive')
    return t('logbook.detail.noaaStatusQuiet')
  }

  const drapImpactText = () => {
    const xrayClass = conditions?.propagation.xrayClass
    if (!xrayClass) return t('logbook.detail.drapNoXrayData')
    if (xrayClass.startsWith('X')) return t('logbook.detail.drapStrong')
    if (xrayClass.startsWith('M')) return t('logbook.detail.drapModerate')
    if (xrayClass.startsWith('C')) return t('logbook.detail.drapLow')
    return t('logbook.detail.drapNone')
  }

  const lightLabel = (value: string) => {
    if (value === 'Dags' + 'lys') return t('logbook.detail.daylight')
    if (value === 'M\u00f8rke' || value === 'M\u00c3\u00b8rke') return t('logbook.detail.darkness')
    return t('logbook.detail.grayline')
  }

  const pathSummaryLabel = (value: string | null | undefined) => {
    if (!value) return t('logbook.detail.pathNotCalculated')
    if (value === 'Dags' + 'lysrute') return t('logbook.detail.pathDaylight')
    if (value === 'M\u00f8rkerute' || value === 'M\u00c3\u00b8rkerute') return t('logbook.detail.pathDarkness')
    if (value.includes('Grayline')) return t('logbook.detail.pathGrayline')
    return t('logbook.detail.pathMixed')
  }

  const bandRatingLabel = (rating: string) => {
    if (rating === PROPAGATION_RATING_GOOD) return t('logbook.detail.ratingGood')
    if (rating === PROPAGATION_RATING_WEAK) return t('logbook.detail.ratingWeak')
    return t('logbook.detail.ratingOk')
  }

  const bandReasonLabel = (reason: string, rating: string) => {
    if (reason.startsWith('Grayline')) return t('logbook.detail.bandReason.grayline')
    if (reason.includes('rkesti')) return t('logbook.detail.bandReason.darkness')
    if (reason.includes('ionisering')) return t('logbook.detail.bandReason.daylight')
    if (rating === PROPAGATION_RATING_WEAK) return t('logbook.detail.bandReason.weak')
    return t('logbook.detail.bandReason.neutral')
  }

  return (
    <div className={pageShellClass}>
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold text-white">{t('logbook.detail.title')}</h1>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => router.push('/logbook')}>
            {t('logbook.backToLogbook')}
          </Button>
          <Button type="button" variant="danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? t('common.deleting') : t('logbook.detail.deleteQso')}
          </Button>
        </div>
      </div>
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
              {t('logbook.detail.tabs.details')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('map')}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === 'map' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {t('logbook.detail.tabs.map')}
            </button>
            <button
              type="button"
              onClick={openConditionsTab}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === 'conditions' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {t('logbook.detail.tabs.conditions')}
            </button>
            <button
              type="button"
              onClick={openPropagationTab}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === 'propagation' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {t('logbook.detail.tabs.propagation')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('qsl')}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === 'qsl' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {t('logbook.detail.tabs.qsl')}
            </button>
          </div>

          {activeTab === 'details' ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">

            <div className="grid grid-cols-2 gap-3">
              <Input label={`${t('qso.dateTimeUtc')} *`} type="datetime-local" value={form.dateUtc} onChange={set('dateUtc')} required />
              <Input label={`${t('qso.ownCallsign')} *`} value={form.ownCallsign} onChange={set('ownCallsign')} required />
            </div>

            <Input label={`${t('qso.workedCallsign')} *`} value={form.workedCallsign} onChange={set('workedCallsign')} required />

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-300">{t('qso.band')}</label>
                <select value={form.band} onChange={set('band')} className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white text-sm">
                  {Object.entries(BandLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-300">{t('qso.mode')}</label>
                <select value={form.mode} onChange={set('mode')} className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white text-sm">
                  {Object.entries(ModeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <Input label={t('qso.submode')} value={form.submode} onChange={set('submode')} placeholder="USB, LSB, JT65..." />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Input label={t('qso.frequencyMhz')} type="number" step="0.001" value={form.frequency} onChange={set('frequency')} />
              <Input label={t('qso.rstSent')} value={form.rstSent} onChange={set('rstSent')} />
              <Input label={t('qso.rstReceived')} value={form.rstReceived} onChange={set('rstReceived')} />
            </div>

            <div className="border-t border-gray-700 pt-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">{t('logbook.detail.location')}</p>
              <div className="grid grid-cols-2 gap-3">
                <Input label={t('qso.contactGrid')} value={form.locator} onChange={set('locator')} placeholder="JO55WM" />
                <Input label={t('qso.myGrid')} value={form.myGridsquare} onChange={set('myGridsquare')} placeholder="JO65DQ" />
              </div>
              <div className="mt-3 flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-300">{t('qso.myStationRig')}</label>
                <select value={form.stationId} onChange={setStation} className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white text-sm">
                  <option value="">{t('qso.selectStation')}</option>
                  {stations.map(station => (
                    <option key={station.id} value={station.id}>{stationOptionLabel(station)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="border-t border-gray-700 pt-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">{t('logbook.detail.dxInfo')}</p>
              <div className="grid grid-cols-2 gap-3">
                <Input label={t('qso.country')} value={form.country} onChange={set('country')} />
                <Input label={t('qso.dxcc')} type="number" value={form.dxcc} onChange={set('dxcc')} placeholder="291" />
              </div>
              <div className="grid grid-cols-3 gap-3 mt-3">
                <Input label={t('decode.selected.continent')} value={form.continent} onChange={set('continent')} placeholder="EU" />
                <Input label={t('qso.stateProvince')} value={form.state} onChange={set('state')} placeholder="CA" />
                <Input label={t('qso.county')} value={form.county} onChange={set('county')} placeholder="Cook, IL" />
              </div>
              <div className="grid grid-cols-3 gap-3 mt-3">
                <Input label={t('qso.cqZone')} type="number" value={form.cqZone} onChange={set('cqZone')} placeholder="14" />
                <Input label={t('qso.ituZone')} type="number" value={form.ituZone} onChange={set('ituZone')} placeholder="18" />
                <Input label={t('qso.iota')} value={form.iota} onChange={set('iota')} placeholder="EU-030" />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <Input label={t('qso.myStateProvince')} value={form.myState} onChange={set('myState')} placeholder="SJ" />
                <Input label={t('qso.myCounty')} value={form.myCounty} onChange={set('myCounty')} placeholder="Aalborg" />
              </div>
              <div className="grid grid-cols-3 gap-3 mt-3">
                <Input label={t('qso.potaRefs')} value={form.potaRefs} onChange={set('potaRefs')} placeholder="OZ-0001" />
                <Input label={t('qso.sotaRefs')} value={form.sotaRefs} onChange={set('sotaRefs')} placeholder="OZ/OZ-001" />
                <Input label={t('qso.awardRefs')} value={form.awardRefs} onChange={set('awardRefs')} placeholder="SPECIAL-2026" />
              </div>
            </div>

            <div className="border-t border-gray-700 pt-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">{t('logbook.detail.operatorInfo')}</p>
              <div className="grid grid-cols-2 gap-3">
                <Input label={t('qso.name')} value={form.name} onChange={set('name')} />
                <Input label={t('qso.qth')} value={form.qth} onChange={set('qth')} />
              </div>
              <div className="mt-3">
                <Input label={t('qso.txPower')} type="number" step="0.1" value={form.txPower} onChange={set('txPower')} />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-300">{t('qso.comment')}</label>
              <textarea rows={2} value={form.comment} onChange={set('comment')} className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white text-sm" />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-3">
              <Button type="submit" disabled={saving}>{saving ? t('common.saving') : t('logbook.detail.saveChanges')}</Button>
              <Button type="button" variant="secondary" onClick={() => router.push('/logbook')}>{t('common.cancel')}</Button>
            </div>
            </form>
          ) : activeTab === 'map' ? (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">{t('logbook.detail.qsoLocation')}</h2>
                <p className="mt-1 text-sm text-gray-400">
                  {t('logbook.detail.mapHelp')}
                </p>
              </div>

              {mapMarkers.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-gray-700">
                  <Suspense fallback={<div className="flex h-96 items-center justify-center bg-gray-800 text-gray-400">{t('logbook.detail.loadingMap')}</div>}>
                    <Map markers={mapMarkers} height="clamp(420px, calc(100vh - 280px), 760px)" />
                  </Suspense>
                </div>
              ) : (
                <div className="flex min-h-64 items-center justify-center rounded-lg border border-dashed border-gray-700 bg-gray-900/40 px-6 text-center text-sm text-gray-400">
                  {t('logbook.detail.noValidGridLocators')}
                </div>
              )}
            </div>
          ) : activeTab === 'conditions' ? (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">{t('logbook.detail.weatherTitle')}</h2>
                  <p className="mt-1 text-sm text-gray-400">
                    {t('logbook.detail.weatherHistoryDescription')}
                  </p>
                </div>
                <Button type="button" variant="secondary" onClick={refreshConditions} disabled={conditionsLoading}>
                  {conditionsLoading ? t('common.loading') : t('logbook.detail.refreshConditions')}
                </Button>
              </div>

              {conditionsLoading && !conditions ? (
                <div className="rounded-lg border border-gray-700 bg-gray-900/40 px-4 py-6 text-sm text-gray-400">
                  {t('logbook.detail.loadingWeather')}
                </div>
              ) : conditionsError ? (
                <div className="rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-100">
                  {conditionsError}
                </div>
              ) : conditions ? (
                <>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-lg border border-gray-700 bg-gray-900/30 p-4">
                      <p className="text-xs uppercase tracking-wide text-gray-500">{t('logbook.detail.qsoTime')}</p>
                      <p className="mt-2 text-sm font-semibold text-white">
                        {new Date(conditions.qsoTimeUtc).toLocaleString(language, { timeZone: 'UTC' })} UTC
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {t('logbook.detail.weatherHour', { time: new Date(conditions.nearestWeatherHourUtc).toLocaleTimeString(language, { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' }) })}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-700 bg-gray-900/30 p-4">
                      <p className="text-xs uppercase tracking-wide text-gray-500">{t('logbook.detail.distance')}</p>
                      <p className="mt-2 text-sm font-semibold text-white">{formatNumber(conditions.distanceKm, ' km', 1)}</p>
                    </div>
                    <div className="rounded-lg border border-gray-700 bg-gray-900/30 p-4">
                      <p className="text-xs uppercase tracking-wide text-gray-500">{t('logbook.detail.bearing')}</p>
                      <p className="mt-2 text-sm font-semibold text-white">{formatNumber(conditions.bearingDegrees, ' deg')}</p>
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
                              {location.grid} - {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                            </p>
                          </div>
                          <Badge variant={location.weather ? 'success' : 'default'}>
                            {location.weather ? t('logbook.detail.weatherFound') : t('logbook.detail.noWeather')}
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
                            {t('logbook.detail.noHistoricalWeather')}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div key="missing-location" className="rounded-lg border border-dashed border-gray-700 bg-gray-900/30 p-4 text-sm text-gray-400">
                        {t('logbook.detail.missingGridForStation')}
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-gray-500">{t('logbook.detail.weatherSource', { source: conditions.weatherSource })}</p>
                </>
              ) : (
                <div className="rounded-lg border border-gray-700 bg-gray-900/40 px-4 py-6 text-sm text-gray-400">
                  {t('logbook.detail.reopenConditions')}
                </div>
              )}
            </div>
          ) : activeTab === 'propagation' ? (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">{t('logbook.detail.tabs.propagation')}</h2>
                  <p className="mt-1 text-sm text-gray-400">
                    {t('logbook.detail.propagationDescription')}
                  </p>
                </div>
                <Button type="button" variant="secondary" onClick={refreshConditions} disabled={conditionsLoading}>
                  {conditionsLoading ? t('common.loading') : t('logbook.detail.refreshPropagation')}
                </Button>
              </div>

              {conditionsLoading && !conditions ? (
                <div className="rounded-lg border border-gray-700 bg-gray-900/40 px-4 py-6 text-sm text-gray-400">
                  {t('logbook.detail.loadingPropagation')}
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
                        <p className="font-medium text-white">{t('logbook.detail.noaaRadioConditions')}</p>
                        <p className="mt-1 text-blue-100">{noaaStatusText()}</p>
                      </div>
                      <Badge variant="info">{conditions.propagation.source}</Badge>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                      <div className="rounded-lg border border-blue-800/50 bg-gray-950/30 p-4">
                        <div className="flex items-end justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-blue-200/70">{t('logbook.detail.geomagneticDisturbance')}</p>
                            <p className="mt-1 text-2xl font-semibold text-white">
                              {conditions.propagation.kpIndex == null ? t('logbook.detail.kpUnknown') : `Kp ${conditions.propagation.kpIndex.toFixed(2)}`}
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
                          <span>{t('logbook.detail.quiet')}</span>
                          <span>{t('logbook.detail.active')}</span>
                          <span>{t('logbook.detail.storm')}</span>
                        </div>
                      </div>

                      <div className="rounded-lg border border-blue-800/50 bg-gray-950/30 p-4">
                        <p className="text-xs uppercase tracking-wide text-blue-200/70">{t('logbook.detail.noaaScales')}</p>
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
                            ? t('logbook.detail.minutesFromQso', { minutes: conditions.propagation.minutesFromQso?.toFixed(0) ?? '?' })
                            : t('logbook.detail.noNoaaTimestamp')}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div className="rounded-lg border border-blue-800/50 bg-gray-950/30 p-4">
                        <p className="text-xs uppercase tracking-wide text-blue-200/70">{t('logbook.detail.goesXrayDrap')}</p>
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <div className="rounded-md bg-gray-900/70 px-3 py-2">
                            <p className="text-xs text-blue-200/60">{t('logbook.detail.flareClass')}</p>
                            <p className="mt-1 text-base font-semibold text-white">{conditions.propagation.xrayClass ?? t('common.unknown')}</p>
                          </div>
                          <div className="rounded-md bg-gray-900/70 px-3 py-2">
                            <p className="text-xs text-blue-200/60">{t('logbook.detail.xrayFlux')}</p>
                            <p className="mt-1 text-base font-semibold text-white">{formatNumber(conditions.propagation.xrayFlux, ' W/m2', 8)}</p>
                          </div>
                        </div>
                        <p className="mt-3 text-sm text-blue-100">{drapImpactText()}</p>
                        <a className="mt-2 inline-block text-xs text-blue-200 underline" href={conditions.propagation.dRegionAbsorption.sourceUrl} target="_blank" rel="noreferrer">
                          {t('logbook.detail.openNoaaDrap')}
                        </a>
                      </div>

                      <div className="rounded-lg border border-blue-800/50 bg-gray-950/30 p-4">
                        <p className="text-xs uppercase tracking-wide text-blue-200/70">{t('logbook.detail.solarWind')}</p>
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-blue-200/60">{t('logbook.detail.speed')}</p>
                            <p className="mt-1 text-base font-semibold text-white">{formatNumber(conditions.propagation.solarWindSpeedKms, ' km/s', 1)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-blue-200/60">{t('logbook.detail.density')}</p>
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
                          <p className="text-xs uppercase tracking-wide text-blue-200/70">{t('logbook.detail.solarCycle25')}</p>
                          <p className="mt-1 text-base font-semibold text-white">
                            {conditions.propagation.solarCyclePhase ?? t('logbook.detail.unknownPhase')}
                          </p>
                        </div>
                        <p className="text-sm font-medium text-blue-100">
                          SSN {formatNumber(conditions.propagation.sunspotNumber)}
                        </p>
                      </div>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div>
                          <div className="flex justify-between text-xs text-blue-200/70">
                            <span>{t('logbook.detail.minimum')}</span>
                            <span>{t('logbook.detail.peak')}</span>
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

                    <p className="mt-4 text-xs text-blue-200/80">{propagationDescriptionText()}</p>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                    <div className="rounded-lg border border-gray-700 bg-gray-900/30 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-gray-500">{t('logbook.detail.graylinePathDaylight')}</p>
                          <h3 className="mt-1 text-base font-semibold text-white">
                            {pathSummaryLabel(conditions.propagation.path?.summary)}
                          </h3>
                        </div>
                        <Badge variant="info">Path</Badge>
                      </div>
                      {conditions.propagation.path ? (
                        <div className="mt-4 grid gap-3">
                          {[
                            [t('logbook.detail.myStation'), conditions.propagation.path.ownLight, conditions.propagation.path.ownSolarElevationDegrees],
                            [t('logbook.detail.midpoint'), conditions.propagation.path.midpointLight, conditions.propagation.path.midpointSolarElevationDegrees],
                            [t('qso.contact'), conditions.propagation.path.workedLight, conditions.propagation.path.workedSolarElevationDegrees],
                          ].map(([label, light, elevation]) => (
                            <div key={label} className="flex items-center justify-between rounded-md bg-gray-950/40 px-3 py-2">
                              <div>
                                <p className="text-xs text-gray-500">{label}</p>
                                <p className="text-sm font-medium text-white">{lightLabel(String(light))}</p>
                              </div>
                              <p className="text-sm text-gray-300">{Number(elevation).toFixed(1)} deg</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-4 text-sm text-gray-400">{t('logbook.detail.missingPathGrid')}</p>
                      )}
                    </div>

                    <div className="rounded-lg border border-gray-700 bg-gray-900/30 p-4">
                      <p className="text-xs uppercase tracking-wide text-gray-500">{t('logbook.detail.bandSnapshot')}</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        {conditions.propagation.bandConditions.map(band => (
                          <div key={band.band} className={`rounded-md border px-3 py-2 ${band.isCurrentQsoBand ? 'border-blue-500 bg-blue-950/40' : 'border-gray-800 bg-gray-950/40'}`}>
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-semibold text-white">{band.band}</p>
                              <Badge variant={ratingVariant(band.rating)}>{bandRatingLabel(band.rating)}</Badge>
                            </div>
                            <p className="mt-2 text-xs text-gray-400">{bandReasonLabel(band.reason, band.rating)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                </>
              ) : (
                <div className="rounded-lg border border-gray-700 bg-gray-900/40 px-4 py-6 text-sm text-gray-400">
                  {t('logbook.detail.reopenPropagation')}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">{t('logbook.detail.externalLogsTitle')}</h2>
                  <p className="mt-1 text-sm text-gray-400">
                    {t('logbook.detail.externalLogsDescription')}
                  </p>
                </div>
                <Button type="button" variant="secondary" onClick={refreshExternalStatus} disabled={externalLoading}>
                  {externalLoading ? t('profile.updating') : t('logbook.detail.refreshStatus')}
                </Button>
              </div>

              {externalLoading && externalStatuses.length === 0 ? (
                <div className="rounded-lg border border-gray-700 bg-gray-900/40 px-4 py-6 text-sm text-gray-400">
                  {t('logbook.detail.loadingQslStatus')}
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-3">
                  {externalStatuses.map(status => (
                    <div key={status.provider} className={`rounded-lg border p-4 ${providerTone(status)}`}>
                      {(() => {
                        const action = externalPrimaryAction(status)
                        const actionLabel = externalActionLabel(status, action, t)
                        const fetchLabel = externalActionLabel(status, { kind: 'fetch', disabled: false }, t)
                        const lastResult = externalLastResult(status, t)
                        return (
                          <>
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-white">{status.provider}</h3>
                          {status.externalId && (
                            <p className="mt-1 font-mono text-xs text-gray-500">ID {status.externalId}</p>
                          )}
                        </div>
                        <Badge variant={badgeVariant(status.status)}>{externalStatusLabel(status, t)}</Badge>
                      </div>

                      <p className="min-h-16 text-sm text-gray-300">{externalStatusDescription(status, t)}</p>

                      <div className="mt-4 space-y-2 rounded-md border border-gray-800 bg-gray-950/40 p-3 text-xs text-gray-400">
                        <div className="flex justify-between gap-3">
                          <span>{t('logbook.detail.setup')}</span>
                          <span className={status.isConfigured ? 'text-green-300' : 'text-gray-500'}>
                            {status.isConfigured ? t('logbook.detail.active') : t('logbook.detail.inactive')}
                          </span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span>{t('logbook.detail.latestActivity')}</span>
                          <span className="text-right text-gray-300">
                            {status.lastUpdatedAt ? new Date(status.lastUpdatedAt).toLocaleString(language) : t('common.none')}
                          </span>
                        </div>
                        {lastResult && (
                          <p className="border-t border-gray-800 pt-2 text-gray-300">{lastResult}</p>
                        )}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {action.kind === 'setup' ? (
                          <Button type="button" size="sm" variant="secondary" onClick={() => handleSetupExternal(status.provider)}>
                            {actionLabel}
                          </Button>
                        ) : action.kind === 'send' ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleSendExternal(status.provider)}
                              disabled={action.disabled || externalLoading}
                            >
                              {actionLabel}
                            </Button>
                            {status.canFetch && (
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() => handleFetchExternal(status.provider)}
                                disabled={externalLoading}
                              >
                                {fetchLabel}
                              </Button>
                            )}
                          </>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => handleFetchExternal(status.provider)}
                            disabled={action.disabled || externalLoading}
                          >
                            {actionLabel}
                          </Button>
                        )}
                      </div>
                          </>
                        )
                      })()}
                    </div>
                  ))}
                  {externalStatuses.length === 0 && (
                    <div className="rounded-lg border border-gray-700 bg-gray-900/30 p-4 text-sm text-gray-400">
                      {t('logbook.detail.noExternalStatus')}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
