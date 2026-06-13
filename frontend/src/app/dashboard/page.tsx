'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { BandLabels, ModeLabels, type Qso, type DxSpot } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { useRequireAuth } from '@/hooks/useRequireAuth'

export default function DashboardPage() {
  const { user } = useAuth()
  const { isLoading } = useRequireAuth()
  if (isLoading) return null
  const [recentQsos, setRecentQsos] = useState<Qso[]>([])
  const [recentSpots, setRecentSpots] = useState<DxSpot[]>([])

  useEffect(() => {
    api.qsos.getMine().then(q => setRecentQsos(q.slice(0, 5))).catch(() => {})
    api.spots.getLatest(5).then(setRecentSpots).catch(() => {})
  }, [])

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
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
