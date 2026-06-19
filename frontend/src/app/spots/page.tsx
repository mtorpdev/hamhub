'use client'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { BandLabels, ModeLabels, type DxSpot, type ClusterSpot } from '@/lib/types'
import { useLanguage } from '@/i18n/LanguageContext'
import { formatDate } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { pageShellClass } from '@/lib/layout'

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
  const { t } = useLanguage()
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
    let cancelled = false
    async function loadInitialSpots() {
      setLoading(true)
      const latest = await api.spots.getLatest(200)
      if (cancelled) return
      setSpots(latest)
      setLoading(false)
    }

    loadInitialSpots().catch(() => {
      if (!cancelled) setLoading(false)
    })
    refreshRef.current = setInterval(loadLocal, 60000)
    return () => {
      cancelled = true
      if (refreshRef.current) clearInterval(refreshRef.current)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      api.qsos.getMine().then(qsos => {
        setWorkedCallsigns(new Set(qsos.map(q => q.workedCallsign.toUpperCase())))
      }).catch(() => {})
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (tab !== 'cluster') return
    let cancelled = false

    async function loadClusterSpots() {
      setClusterLoading(true)
      const latest = await api.spots.getCluster(50)
      if (cancelled) return
      setClusterSpots(latest)
      setClusterLoading(false)
    }

    loadClusterSpots().catch(() => {
      if (!cancelled) setClusterLoading(false)
    })
    const id = setInterval(loadCluster, 60000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [tab])

  const handleDelete = async (id: number) => {
    if (!confirm(t('spots.deleteConfirm'))) return
    try {
      await api.spots.delete(id)
      toast(t('spots.deleted'))
      loadLocal()
    } catch {
      toast(t('spots.deleteFailed'), 'error')
    }
  }

  const localHeaders = [t('spots.callsign'), t('spots.frequencyMhz'), t('spots.band'), t('spots.mode'), t('spots.comment'), t('spots.spotter'), t('spots.time'), '', '']
  const clusterHeaders = [t('spots.callsign'), t('spots.frequencyKhz'), t('spots.mode'), t('spots.info'), t('spots.spotter'), t('spots.source'), t('spots.time')]
  const totalPages = Math.ceil(spots.length / PAGE_SIZE)

  return (
    <div className={pageShellClass}>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">{t('spots.title')}</h1>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-500" />
            {t('spots.autoRefresh')}
          </span>
          {isAuthenticated && <Link href="/spots/new"><Button>+ {t('spots.new')}</Button></Link>}
        </div>
      </div>

      <div className="mb-4 flex gap-1 border-b border-gray-700">
        {(['local', 'cluster'] as const).map(tabId => (
          <button
            key={tabId}
            onClick={() => setTab(tabId)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${tab === tabId ? 'border-blue-500 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
          >
            {tabId === 'local' ? t('spots.hamHub') : t('spots.cluster')}
          </button>
        ))}
      </div>

      {tab === 'local' && (
        <Card>
          <CardContent className="p-0">
            {loading ? <p className="p-6 text-gray-400">{t('common.loading')}</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-800/50">
                    <tr>{localHeaders.map(header => <th key={header} className="px-4 py-3 text-left font-medium text-gray-400">{header}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {spots.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(spot => (
                      <tr key={spot.id} className="transition-colors hover:bg-gray-800/30">
                        <td className="px-4 py-3 font-mono font-bold text-white">
                          {spot.callsign}
                          {isAuthenticated && workedCallsigns.has(spot.callsign.toUpperCase()) && (
                            <span className="ml-2 rounded border border-green-700 bg-green-800 px-1.5 py-0.5 text-xs text-green-300" title={t('spots.workedTitle')}>{t('spots.worked')}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-300">{spot.frequency.toFixed(3)}</td>
                        <td className="px-4 py-3"><Badge variant="info">{BandLabels[spot.band]}</Badge></td>
                        <td className="px-4 py-3"><Badge>{ModeLabels[spot.mode]}</Badge></td>
                        <td className="max-w-xs truncate px-4 py-3 text-gray-400">{spot.comment || '-'}</td>
                        <td className="px-4 py-3 font-mono text-gray-400">{spot.spotterCallsign}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{formatDate(spot.spottedAt)}</td>
                        <td className="px-4 py-3">
                          {isAuthenticated && spot.userId === user?.id && (
                            <button onClick={() => handleDelete(spot.id)} className="text-xs text-red-500 hover:text-red-400">{t('common.delete')}</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {spots.length === 0 && <p className="p-6 text-gray-400">{t('spots.noLocal')}</p>}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'cluster' && (
        <Card>
          <CardContent className="p-0">
            {clusterLoading && clusterSpots.length === 0 ? <p className="p-6 text-gray-400">{t('spots.loadingCluster')}</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-800/50">
                    <tr>{clusterHeaders.map(header => <th key={header} className="px-4 py-3 text-left font-medium text-gray-400">{header}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {clusterSpots.map((spot, index) => (
                      <tr key={index} className="transition-colors hover:bg-gray-800/30">
                        <td className="px-4 py-3 font-mono font-bold text-white">{spot.callsign}</td>
                        <td className="px-4 py-3 text-gray-300">{Number(spot.frequencyKhz ?? spot.frequency).toFixed(1)}</td>
                        <td className="px-4 py-3"><Badge>{spot.mode || '-'}</Badge></td>
                        <td className="max-w-xs truncate px-4 py-3 text-gray-400">{spot.info || '-'}</td>
                        <td className="px-4 py-3 font-mono text-gray-400">{spot.spotter}</td>
                        <td className="px-4 py-3"><Badge variant="info">{spot.source || 'DX Cluster'}</Badge></td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{spot.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {clusterSpots.length === 0 && !clusterLoading && (
                  <div className="p-6 text-center">
                    <p className="mb-3 text-gray-400">{t('spots.noCluster')}</p>
                    <Button variant="secondary" onClick={loadCluster}>{t('spots.tryAgain')}</Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'local' && spots.length > PAGE_SIZE && (
        <div className="mt-3 flex items-center justify-end gap-2">
          <button onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page === 1} className="rounded bg-gray-700 px-3 py-1 text-sm text-gray-300 disabled:opacity-40">{'<'}</button>
          <span className="text-sm text-gray-400">{t('spots.page', { page, total: totalPages })}</span>
          <button onClick={() => setPage(current => Math.min(totalPages, current + 1))} disabled={page >= totalPages} className="rounded bg-gray-700 px-3 py-1 text-sm text-gray-300 disabled:opacity-40">{'>'}</button>
        </div>
      )}
    </div>
  )
}
