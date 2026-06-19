'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { BandLabels, ModeLabels, type User, type Station } from '@/lib/types'
import { useLanguage } from '@/i18n/LanguageContext'
import { pageShellClass } from '@/lib/layout'

export default function UserProfilePage() {
  const { t } = useLanguage()
  const { callsign } = useParams<{ callsign: string }>()
  const [user, setUser] = useState<User | null>(null)
  const [stations, setStations] = useState<Station[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!callsign) return
    api.users.searchByCallsign(callsign)
      .then(async (u) => {
        setUser(u)
        const all = await api.stations.getAll()
        setStations(all.filter((station) => station.userId === u.id))
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [callsign])

  if (loading) return <div className={`${pageShellClass} text-gray-400`}>{t('common.loading')}</div>

  if (notFound || !user) return (
    <div className={pageShellClass}>
      <p className="text-gray-400 mb-4">
        {t('users.notFoundPrefix')}{' '}
        <span className="font-mono text-white">{callsign?.toUpperCase()}</span>.
      </p>
      <Link href="/callsign-search" className="text-blue-400 hover:text-blue-300">
        &lt; {t('users.searchAgain')}
      </Link>
    </div>
  )

  return (
    <div className={pageShellClass}>
      <Link href="/callsign-search" className="text-blue-400 hover:text-blue-300 text-sm mb-6 block">
        &lt; {t('callsign.title')}
      </Link>

      <Card className="mb-6">
        <CardContent className="py-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-blue-900 flex items-center justify-center text-xl font-semibold text-blue-100 flex-shrink-0">
              {user.callsign?.slice(0, 2).toUpperCase() || 'HH'}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white font-mono">{user.callsign}</h1>
              {(user.firstName || user.lastName) && (
                <p className="text-gray-400">{user.firstName} {user.lastName}</p>
              )}
              <div className="flex flex-wrap gap-4 mt-3 text-sm">
                {user.country && <span className="text-gray-400">{t('users.country')}: {user.country}</span>}
                {user.gridLocator && <span className="text-gray-400 font-mono">{t('users.grid')}: {user.gridLocator}</span>}
                {user.licenseClass !== null && <span className="text-gray-400">{t('users.licenseClass')}: {user.licenseClass}</span>}
              </div>
              {user.profileDescription && (
                <p className="text-gray-300 mt-3 text-sm leading-relaxed">{user.profileDescription}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {stations.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-white mb-3">{t('callsign.stations')}</h2>
          <div className="flex flex-col gap-3">
            {stations.map((station) => (
              <Card key={station.id}>
                <CardHeader>
                  <CardTitle>
                    {station.name}
                    {station.callsign && <span className="text-blue-400 font-mono ml-2 text-base">{station.callsign}</span>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-gray-400 flex flex-col gap-1">
                    {station.radioEquipment && <p>{t('callsign.equipment')}: {station.radioEquipment}</p>}
                    {station.antennaDescription && <p>{t('callsign.antenna')}: {station.antennaDescription}</p>}
                    {station.powerOutput && <p>{t('users.power')}: {station.powerOutput} W</p>}
                    {station.location && <p>{t('users.location')}: {station.location}</p>}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {station.supportedBands.map((band) => <Badge key={band} variant="info">{BandLabels[band]}</Badge>)}
                      {station.supportedModes.map((mode) => <Badge key={mode}>{ModeLabels[mode]}</Badge>)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
