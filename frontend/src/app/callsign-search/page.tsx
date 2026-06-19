'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { BandLabels, ModeLabels, type QrzCallsignInfo, type Station, type User } from '@/lib/types'
import { pageShellClass } from '@/lib/layout'
import { useLanguage } from '@/i18n/LanguageContext'

export default function CallsignSearchPage() {
  const { t } = useLanguage()
  const [callsign, setCallsign] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const [stations, setStations] = useState<Station[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [qrzInfo, setQrzInfo] = useState<QrzCallsignInfo | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (callsign.length < 3) {
      debounceRef.current = setTimeout(() => setQrzInfo(null), 0)
      return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    }
    debounceRef.current = setTimeout(async () => {
      try {
        setQrzInfo(await api.qrz.lookup(callsign))
      } catch {
        setQrzInfo(null)
      }
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [callsign])

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!callsign.trim()) return
    setLoading(true)
    setError('')
    setUser(null)
    setStations([])
    setSearched(true)
    try {
      const found = await api.users.searchByCallsign(callsign.trim())
      setUser(found)
      const allStations = await api.stations.getAll()
      setStations(allStations.filter(station => station.userId === found.id))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : ''
      setError(message.includes('404') || message.includes('HTTP 404')
        ? t('callsign.notFound', { callsign: callsign.toUpperCase() })
        : t('callsign.searchFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={pageShellClass}>
      <h1 className="text-3xl font-bold text-white mb-8">{t('callsign.title')}</h1>
      <form onSubmit={handleSearch} className="flex gap-3 mb-8">
        <Input className="flex-1" placeholder={t('callsign.placeholder')} value={callsign} onChange={event => setCallsign(event.target.value.toUpperCase())} />
        <Button type="submit" disabled={loading}>{loading ? t('callsign.searching') : t('common.search')}</Button>
      </form>

      {error && <p className="text-red-400 mb-6">{error}</p>}

      {user && (
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{user.callsign || t('callsign.unknown')}</CardTitle>
              {user.callsign && <Link href={`/users/${user.callsign}`} className="text-blue-400 hover:text-blue-300 text-sm">{t('callsign.viewProfile')} &rarr;</Link>}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-400">{t('qso.name')}: </span><span className="text-white">{user.firstName} {user.lastName}</span></div>
                <div><span className="text-gray-400">{t('qso.country')}: </span><span className="text-white">{user.country || '-'}</span></div>
                <div><span className="text-gray-400">{t('qso.gridLocator')}: </span><span className="text-white font-mono">{user.gridLocator || '-'}</span></div>
                <div><span className="text-gray-400">{t('callsign.license')}: </span><span className="text-white">{user.licenseClass !== null ? user.licenseClass : '-'}</span></div>
                {user.profileDescription && <div className="col-span-2"><span className="text-gray-400">{t('callsign.about')}: </span><span className="text-white">{user.profileDescription}</span></div>}
              </div>
            </CardContent>
          </Card>

          {stations.length > 0 && (
            <Card>
              <CardHeader><CardTitle>{t('callsign.stations')}</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  {stations.map(station => (
                    <div key={station.id} className="text-sm">
                      <p className="font-semibold text-white">{station.name}</p>
                      {station.radioEquipment && <p className="text-gray-400">{t('callsign.equipment')}: {station.radioEquipment}</p>}
                      {station.antennaDescription && <p className="text-gray-400">{t('callsign.antenna')}: {station.antennaDescription}</p>}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {station.supportedBands.map(band => <Badge key={band} variant="info">{BandLabels[band]}</Badge>)}
                        {station.supportedModes.map(mode => <Badge key={mode}>{ModeLabels[mode]}</Badge>)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {qrzInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              QRZ: {qrzInfo.callsign}
              {qrzInfo.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrzInfo.imageUrl} alt={qrzInfo.callsign} className="h-10 w-10 rounded-full object-cover" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {qrzInfo.name && <div><span className="text-gray-400">{t('qso.name')}: </span><span className="text-white">{qrzInfo.name}</span></div>}
              {qrzInfo.country && <div><span className="text-gray-400">{t('qso.country')}: </span><span className="text-white">{qrzInfo.country}</span></div>}
              {qrzInfo.grid && <div><span className="text-gray-400">{t('qso.gridLocator')}: </span><span className="text-white font-mono">{qrzInfo.grid}</span></div>}
              {qrzInfo.dxcc && <div><span className="text-gray-400">{t('qso.dxcc')}: </span><span className="text-white">{qrzInfo.dxcc}</span></div>}
              {qrzInfo.qslVia && <div><span className="text-gray-400">{t('callsign.qslVia')}: </span><span className="text-white">{qrzInfo.qslVia}</span></div>}
              {qrzInfo.email && <div><span className="text-gray-400">{t('auth.email')}: </span><span className="text-white">{qrzInfo.email}</span></div>}
            </div>
          </CardContent>
        </Card>
      )}

      {searched && !user && !error && !loading && (
        <p className="text-gray-400">{t('callsign.noResults')}</p>
      )}
    </div>
  )
}
