'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { BandLabels, ModeLabels, type DxSpot } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'

export default function SpotsPage() {
  const [spots, setSpots] = useState<DxSpot[]>([])
  const [loading, setLoading] = useState(true)
  const { isAuthenticated, user } = useAuth()

  const load = () => api.spots.getLatest(100).then(setSpots).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const handleDelete = async (id: number) => {
    if (!confirm('Slet spot?')) return
    await api.spots.delete(id)
    load()
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-white">DX Spots</h1>
        {isAuthenticated && <Link href="/spots/new"><Button>+ Nyt spot</Button></Link>}
      </div>
      <Card>
        <CardContent className="p-0">
          {loading ? <p className="p-6 text-gray-400">Indlæser...</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-800/50">
                  <tr>
                    {['Kaldesignal', 'Freq (MHz)', 'Band', 'Mode', 'Kommentar', 'Spotter', 'Tid', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-gray-400 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {spots.map(s => (
                    <tr key={s.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-white">{s.callsign}</td>
                      <td className="px-4 py-3 text-gray-300">{s.frequency.toFixed(3)}</td>
                      <td className="px-4 py-3"><Badge variant="info">{BandLabels[s.band]}</Badge></td>
                      <td className="px-4 py-3"><Badge>{ModeLabels[s.mode]}</Badge></td>
                      <td className="px-4 py-3 text-gray-400 max-w-xs truncate">{s.comment || '—'}</td>
                      <td className="px-4 py-3 text-gray-400 font-mono">{s.spotterCallsign}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{formatDate(s.spottedAt)}</td>
                      <td className="px-4 py-3">
                        {isAuthenticated && s.userId === user?.id && (
                          <button onClick={() => handleDelete(s.id)} className="text-red-500 hover:text-red-400 text-xs">Slet</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {spots.length === 0 && <p className="p-6 text-gray-400">Ingen spots endnu.</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
