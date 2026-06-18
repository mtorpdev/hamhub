'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { BandLabels, ModeLabels, type User, type Station } from '@/lib/types'
import { pageShellClass } from '@/lib/layout'

export default function UserProfilePage() {
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
        setStations(all.filter(s => s.userId === u.id))
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [callsign])

  if (loading) return <div className={`${pageShellClass} text-gray-400`}>Indlæser...</div>
  if (notFound || !user) return (
    <div className={pageShellClass}>
      <p className="text-gray-400 mb-4">Ingen bruger fundet med kaldesignalet <span className="font-mono text-white">{callsign?.toUpperCase()}</span>.</p>
      <Link href="/callsign-search" className="text-blue-400 hover:text-blue-300">← Søg igen</Link>
    </div>
  )

  return (
    <div className={pageShellClass}>
      <Link href="/callsign-search" className="text-blue-400 hover:text-blue-300 text-sm mb-6 block">← Callsign Lookup</Link>

      <Card className="mb-6">
        <CardContent className="py-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-blue-900 flex items-center justify-center text-2xl flex-shrink-0">
              📻
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white font-mono">{user.callsign}</h1>
              {(user.firstName || user.lastName) && (
                <p className="text-gray-400">{user.firstName} {user.lastName}</p>
              )}
              <div className="flex flex-wrap gap-4 mt-3 text-sm">
                {user.country && <span className="text-gray-400">🌍 {user.country}</span>}
                {user.gridLocator && <span className="text-gray-400 font-mono">📍 {user.gridLocator}</span>}
                {user.licenseClass !== null && <span className="text-gray-400">🎓 Klasse {user.licenseClass}</span>}
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
          <h2 className="text-xl font-semibold text-white mb-3">Stationer</h2>
          <div className="flex flex-col gap-3">
            {stations.map(s => (
              <Card key={s.id}>
                <CardHeader>
                  <CardTitle>{s.name} {s.callsign && <span className="text-blue-400 font-mono ml-2 text-base">{s.callsign}</span>}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-gray-400 flex flex-col gap-1">
                    {s.radioEquipment && <p>Udstyr: {s.radioEquipment}</p>}
                    {s.antennaDescription && <p>Antenne: {s.antennaDescription}</p>}
                    {s.powerOutput && <p>Effekt: {s.powerOutput} W</p>}
                    {s.location && <p>Placering: {s.location}</p>}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {s.supportedBands.map(b => <Badge key={b} variant="info">{BandLabels[b]}</Badge>)}
                      {s.supportedModes.map(m => <Badge key={m}>{ModeLabels[m]}</Badge>)}
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
