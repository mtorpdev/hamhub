'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Band, BandLabels, Mode, ModeLabels, type Station } from '@/lib/types'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useToast } from '@/contexts/ToastContext'
import { pageShellClass } from '@/lib/layout'
import { defaultStation, stationById, stationGrid, stationOptionLabel } from '../stationGrid'
import { useLanguage } from '@/i18n/LanguageContext'

export default function NewQsoPage() {
  const { user } = useAuth()
  useRequireAuth()
  const { toast } = useToast()
  const { t } = useLanguage()
  const router = useRouter()
  const now = new Date().toISOString().slice(0, 16)
  const [form, setForm] = useState({
    dateUtc: now, ownCallsign: user?.callsign || '', workedCallsign: '',
    band: Band.M20, frequency: '', mode: Mode.SSB,
    rstSent: '59', rstReceived: '59', stationId: '', locator: '', myGridsquare: '', country: '', potaRefs: '', comment: ''
  })
  const [stations, setStations] = useState<Station[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    api.stations.getMine().then(items => {
      if (cancelled) return
      setStations(items)
      const selected = defaultStation(items, user)
      if (selected) {
        setForm(f => ({
          ...f,
          stationId: selected.id.toString(),
          myGridsquare: f.myGridsquare || stationGrid(selected),
          ownCallsign: f.ownCallsign || selected.callsign || user?.callsign || '',
        }))
      }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [user])

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
    setLoading(true)
    try {
      const { stationId, ...payload } = form
      void stationId
      await api.qsos.create({
        ...payload,
        dateUtc: new Date(form.dateUtc).toISOString(),
        frequency: form.frequency ? parseFloat(form.frequency) : undefined,
      })
      toast(t('qso.logged'))
      router.push('/logbook')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('qso.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={pageShellClass}>
      <h1 className="text-3xl font-bold text-white mb-8">{t('logbook.logNewQso')}</h1>
      <Card>
        <CardContent className="py-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Input label={`${t('qso.dateTimeUtc')} *`} type="datetime-local" value={form.dateUtc} onChange={set('dateUtc')} required />
              <Input label={`${t('qso.ownCallsign')} *`} value={form.ownCallsign} onChange={set('ownCallsign')} required />
            </div>
            <Input label={`${t('qso.workedCallsign')} *`} value={form.workedCallsign} onChange={set('workedCallsign')} required placeholder="DL1ABC" />
            <div className="grid grid-cols-2 gap-3">
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
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Input label={t('qso.frequencyMhz')} type="number" step="0.001" value={form.frequency} onChange={set('frequency')} />
              <Input label={t('qso.rstSent')} value={form.rstSent} onChange={set('rstSent')} />
              <Input label={t('qso.rstReceived')} value={form.rstReceived} onChange={set('rstReceived')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label={t('qso.gridLocator')} value={form.locator} onChange={set('locator')} placeholder="JO55WM" />
              <Input label={t('qso.country')} value={form.country} onChange={set('country')} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-300">{t('qso.myStationRig')}</label>
                <select value={form.stationId} onChange={setStation} className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white text-sm">
                  <option value="">{t('qso.selectStation')}</option>
                  {stations.map(station => (
                    <option key={station.id} value={station.id}>{stationOptionLabel(station)}</option>
                  ))}
                </select>
              </div>
              <Input label={t('qso.myGrid')} value={form.myGridsquare} onChange={set('myGridsquare')} placeholder="JO65DQ" />
            </div>
            <Input label={t('qso.potaRefs')} value={form.potaRefs} onChange={set('potaRefs')} placeholder="US-0001" />
            <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-300">{t('qso.notes')}</label>
              <textarea rows={2} value={form.comment} onChange={set('comment')} className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white text-sm" />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <Button type="submit" disabled={loading}>{loading ? t('qso.logging') : t('qso.log')}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
