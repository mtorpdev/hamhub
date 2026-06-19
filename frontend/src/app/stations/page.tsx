'use client'
import { useEffect, useMemo, useState, lazy, Suspense } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { BandLabels, ModeLabels, ProfileVisibility, StationType, type Station } from '@/lib/types'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useToast } from '@/contexts/ToastContext'
import { gridToLatLng } from '@/components/ui/Map'
import { pageShellClass } from '@/lib/layout'
import { primaryStationImage } from './stationUi'
import { useLanguage } from '@/i18n/LanguageContext'

const Map = lazy(() => import('@/components/ui/Map'))

export default function StationsPage() {
  useRequireAuth()
  const { toast } = useToast()
  const { t } = useLanguage()
  const [stations, setStations] = useState<Station[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'map'>('list')

  const stationTypeOptions = useMemo(() => [
    { value: StationType.HomeShack, label: t('station.type.homeShack') },
    { value: StationType.Portable, label: t('station.type.portable') },
    { value: StationType.Mobile, label: t('station.type.mobile') },
    { value: StationType.Remote, label: t('station.type.remote') },
    { value: StationType.ClubStation, label: t('station.type.clubStation') },
    { value: StationType.ContestStation, label: t('station.type.contestStation') },
  ], [t])

  const visibilityOptions = useMemo(() => [
    { value: ProfileVisibility.Public, label: t('profile.visibility.public') },
    { value: ProfileVisibility.MembersOnly, label: t('profile.visibility.membersOnly') },
    { value: ProfileVisibility.Private, label: t('profile.visibility.private') },
  ], [t])

  const stationTypeLabel = (type: StationType) => stationTypeOptions.find(option => option.value === type)?.label ?? t('station.type.homeShack')
  const visibilityLabel = (visibility: ProfileVisibility) => visibilityOptions.find(option => option.value === visibility)?.label ?? t('profile.visibility.private')

  const load = () => api.stations.getMine().then(setStations).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const handleDelete = async (id: number) => {
    if (!confirm(t('station.deleteConfirm'))) return
    try {
      await api.stations.delete(id)
      toast(t('station.deleted'))
      load()
    } catch {
      toast(t('station.deleteFailed'), 'error')
    }
  }

  const mapMarkers = stations
    .filter(s => s.gridLocator)
    .map(s => {
      const pos = gridToLatLng(s.gridLocator!)
      if (!pos) return null
      return { ...pos, label: s.name, popup: `<b>${s.name}</b>${s.callsign ? ` (${s.callsign})` : ''}${s.location ? `<br/>${s.location}` : ''}` }
    })
    .filter(Boolean) as { lat: number; lng: number; label: string; popup: string }[]

  return (
    <div className={pageShellClass}>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-white">{t('station.mine')}</h1>
        <div className="flex gap-2">
          {mapMarkers.length > 0 && (
            <div className="flex gap-1 rounded-lg border border-gray-700 p-1">
              <button onClick={() => setView('list')} className={`px-3 py-1 text-sm rounded ${view === 'list' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`}>{t('station.list')}</button>
              <button onClick={() => setView('map')} className={`px-3 py-1 text-sm rounded ${view === 'map' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`}>{t('station.map')}</button>
            </div>
          )}
          <Link href="/stations/new"><Button>+ {t('station.new')}</Button></Link>
        </div>
      </div>

      {loading ? <p className="text-gray-400">{t('station.loading')}</p> : (
        <>
          {view === 'map' && mapMarkers.length > 0 && (
            <div className="mb-6 rounded-xl overflow-hidden border border-gray-700">
              <Suspense fallback={<div className="h-96 bg-gray-800 flex items-center justify-center text-gray-400">{t('station.loadingMap')}</div>}>
                <Map markers={mapMarkers} height="420px" />
              </Suspense>
            </div>
          )}

          {view === 'list' && (
            <div className="flex flex-col gap-4">
              {stations.map(s => (
                <Card key={s.id} className="overflow-hidden">
                  <div className="grid gap-0 md:grid-cols-[220px_minmax(0,1fr)]">
                    <div className="bg-gray-950">
                      {primaryStationImage(s) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={primaryStationImage(s)!} alt="" className="h-full min-h-44 w-full object-cover" />
                      ) : (
                        <div className="flex h-full min-h-44 items-center justify-center border-b border-gray-700 text-sm text-gray-500 md:border-b-0 md:border-r">
                          {t('station.noImage')}
                        </div>
                      )}
                    </div>
                    <div>
                      <CardHeader className="flex flex-row items-start justify-between gap-4">
                        <div>
                          <CardTitle>{s.name} {s.callsign && <span className="text-blue-400 font-mono ml-2">{s.callsign}</span>}</CardTitle>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-400">
                            <span className="rounded border border-gray-700 px-2 py-1">{stationTypeLabel(s.stationType)}</span>
                            <span className="rounded border border-gray-700 px-2 py-1">{visibilityLabel(s.visibility)}</span>
                            {s.images.length > 0 && <span className="rounded border border-gray-700 px-2 py-1">{t('station.images', { count: s.images.length })}</span>}
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <Link href={`/stations/${s.id}`} className="text-blue-400 hover:text-blue-300 text-sm">{t('station.edit')}</Link>
                          <button onClick={() => handleDelete(s.id)} className="text-red-500 hover:text-red-400 text-sm">{t('station.delete')}</button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm text-gray-400 flex flex-col gap-1">
                          {s.description && <p className="mb-2 text-gray-300">{s.description}</p>}
                          {s.radioEquipment && <p>{t('station.equipment')}: {s.radioEquipment}</p>}
                          {s.antennaDescription && <p>{t('station.antenna')}: {s.antennaDescription}</p>}
                          {s.powerOutput && <p>{t('station.power')}: {s.powerOutput} W</p>}
                          {s.location && <p>{t('station.location')}: {s.location}</p>}
                          {s.gridLocator && <p>{t('station.gridLocator')}: <span className="font-mono">{s.gridLocator}</span></p>}
                          <div className="flex flex-wrap gap-1 mt-2">
                            {s.supportedBands.map(b => <Badge key={b} variant="info">{BandLabels[b]}</Badge>)}
                            {s.supportedModes.map(m => <Badge key={m}>{ModeLabels[m]}</Badge>)}
                          </div>
                        </div>
                      </CardContent>
                    </div>
                  </div>
                </Card>
              ))}
              {stations.length === 0 && <p className="text-gray-400">{t('station.empty')} <Link href="/stations/new" className="text-blue-400">{t('station.createFirst')}</Link></p>}
            </div>
          )}
        </>
      )}
    </div>
  )
}
