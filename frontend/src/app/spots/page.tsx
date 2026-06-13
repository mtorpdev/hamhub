'use client'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { BandLabels, ModeLabels, type DxSpot, type ClusterSpot } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'

const PAGE_SIZE = 25

export default function SpotsPage() {
  const [spots, setSpots] = useState<DxSpot[]>([])
  const [clusterSpots, setClusterSpots] = useState<ClusterSpot[]>([])
  const [workedCallsigns, setWorkedCallsigns] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [clusterLoading, setClusterLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [tab, setTab] = useState<'local' | 'cluster'>('local')
  const { isAuthenticated, user } = useAuth()
  const { toast } = useToast()
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadLocal = () => {
    setPage(1)
    api.spots.getLatest(200).then(setSpots).finally(() => setLoading(false))
  }

  const loadCluster = () => {
    setClusterLoading(true)
    api.spots.getCluster(50).then(setClusterSpots).finally(() => setClusterLoading(false))
  }

  useEffect(() => {
    loadLocal()
    // auto-refresh local spots every 60s
    refreshRef.current = setInterval(loadLocal, 60000)
    return () => { if (refreshRef.current) clearInterval(refreshRef.current) }
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      api.qsos.getMine().then(qsos => {
        setWorkedCallsigns(new Set(qsos.map(q => q.workedCallsign.toUpperCase())))
      }).catch(() => {})
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (tab === 'cluster' && clusterSpots.length === 0) loadCluster()
    if (tab === 'cluster') {
      const id = setInterval(loadCluster, 60000)
      return () => clearInterval(id)
    }
  }, [tab])

  const handleDelete = async (id: number) => {
    if (!confirm('Slet spot?')) return
    try {
      await api.spots.delete(id)
      toast('Spot slettet')
      loadLocal()
    } catch {
      toast('Sletning mislykkedes', 'error')
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">DX Spots</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Auto-opdaterer
          </span>
          {isAuthenticated && <Link href="/spots/new"><Button>+ Nyt spot</Button></Link>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-700">
        {(['local', 'cluster'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${tab === t ? 'border-blue-500 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
          >
            {t === 'local' ? 'HamHub spots' : 'DX Cluster (live)'}
          </button>
        ))}
      </div>

      {tab === 'local' && (
        <Card>
          <CardContent className="p-0">
            {loading ? <p className="p-6 text-gray-400">Indlæser...</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-800/50">
                    <tr>
                      {['Kaldesignal', 'Freq (MHz)', 'Band', 'Mode', 'Kommentar', 'Spotter', 'Tid', '', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-gray-400 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {spots.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(s => (
                      <tr key={s.id} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-white">
                          {s.callsign}
                          {isAuthenticated && workedCallsigns.has(s.callsign.toUpperCase()) && (
                            <span className="ml-2 text-xs bg-green-800 text-green-300 border border-green-700 px-1.5 py-0.5 rounded" title="Du har arbejdet denne station">✓ Worked</span>
                          )}
                        </td>
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
      )}

      {tab === 'cluster' && (
        <Card>
          <CardContent className="p-0">
            {clusterLoading && clusterSpots.length === 0 ? <p className="p-6 text-gray-400">Henter DX Cluster...</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-800/50">
                    <tr>
                      {['Kaldesignal', 'Freq (MHz)', 'Mode', 'Info', 'Spotter', 'Tid'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-gray-400 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {clusterSpots.map((s, i) => (
                      <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-white">{s.callsign}</td>
                        <td className="px-4 py-3 text-gray-300">{Number(s.frequency).toFixed(1)}</td>
                        <td className="px-4 py-3"><Badge>{s.mode || '—'}</Badge></td>
                        <td className="px-4 py-3 text-gray-400 max-w-xs truncate">{s.info || '—'}</td>
                        <td className="px-4 py-3 text-gray-400 font-mono">{s.spotter}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{s.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {clusterSpots.length === 0 && !clusterLoading && (
                  <div className="p-6 text-center">
                    <p className="text-gray-400 mb-3">Ingen cluster spots tilgængeligt.</p>
                    <Button variant="secondary" onClick={loadCluster}>Prøv igen</Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'local' && spots.length > PAGE_SIZE && (
        <div className="flex justify-end gap-2 items-center mt-3">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 text-sm rounded bg-gray-700 text-gray-300 disabled:opacity-40">←</button>
          <span className="text-gray-400 text-sm">Side {page} / {Math.ceil(spots.length / PAGE_SIZE)}</span>
          <button onClick={() => setPage(p => Math.min(Math.ceil(spots.length / PAGE_SIZE), p + 1))} disabled={page >= Math.ceil(spots.length / PAGE_SIZE)} className="px-3 py-1 text-sm rounded bg-gray-700 text-gray-300 disabled:opacity-40">→</button>
        </div>
      )}
    </div>
  )
}
