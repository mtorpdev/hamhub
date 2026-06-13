'use client'
import { useEffect, useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import type { WsjtxDecodeItem } from '@/lib/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
const MAX_ROWS = 200

function snrColor(snr: number) {
  if (snr >= 0) return 'text-green-400'
  if (snr >= -10) return 'text-yellow-400'
  return 'text-red-400'
}

export default function DecodePage() {
  const [decodes, setDecodes] = useState<WsjtxDecodeItem[]>([])
  const [filter, setFilter] = useState<'all' | 'FT8' | 'FT4'>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const [workedCallsigns, setWorkedCallsigns] = useState<Set<string>>(new Set())
  const { isAuthenticated } = useAuth()
  const tableRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isAuthenticated) {
      api.qsos.getMine().then(qsos => {
        setWorkedCallsigns(new Set(qsos.map(q => q.workedCallsign.toUpperCase())))
      }).catch(() => {})
    }
  }, [isAuthenticated])

  useEffect(() => {
    const es = new EventSource(`${API_URL}/api/wsjtx/stream`)
    es.onmessage = (e) => {
      const decode: WsjtxDecodeItem = JSON.parse(e.data)
      setDecodes(prev => {
        const next = [decode, ...prev]
        return next.length > MAX_ROWS ? next.slice(0, MAX_ROWS) : next
      })
    }
    es.onerror = () => {} // browser auto-reconnects
    return () => es.close()
  }, [])

  useEffect(() => {
    if (autoScroll && tableRef.current) {
      tableRef.current.scrollTop = 0
    }
  }, [decodes, autoScroll])

  const visible = filter === 'all' ? decodes : decodes.filter(d => d.mode === filter)

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">Live Decodes</h1>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            SSE live
          </span>
          <Badge variant="info">{decodes.length} decodes</Badge>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex gap-1 border-b border-gray-700">
          {(['all', 'FT8', 'FT4'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${filter === f ? 'border-blue-500 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
            >
              {f === 'all' ? 'Alle' : f}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer ml-auto">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={e => setAutoScroll(e.target.checked)}
            className="accent-blue-500"
          />
          Auto-scroll
        </label>
      </div>

      <Card>
        <CardContent className="p-0">
          <div ref={tableRef} className="overflow-auto max-h-[70vh]">
            <table className="w-full text-sm">
              <thead className="bg-gray-800/50 sticky top-0 z-10">
                <tr>
                  {['Tid', 'Kaldesignal', 'Grid', 'SNR', 'Freq (MHz)', 'Mode', 'Besked', 'Spotter'].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-gray-400 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {visible.map(d => (
                  <tr key={d.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap font-mono">
                      {new Date(d.decodedAt).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="px-3 py-2 font-mono font-bold text-white whitespace-nowrap">
                      {d.dxCallsign ?? '—'}
                      {isAuthenticated && d.dxCallsign && workedCallsigns.has(d.dxCallsign.toUpperCase()) && (
                        <span className="ml-2 text-xs bg-green-800 text-green-300 border border-green-700 px-1.5 py-0.5 rounded">✓ Worked</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-400 font-mono">{d.dxGrid ?? '—'}</td>
                    <td className={`px-3 py-2 font-mono font-bold ${snrColor(d.snr)}`}>{d.snr > 0 ? `+${d.snr}` : d.snr}</td>
                    <td className="px-3 py-2 text-gray-300 font-mono">{d.frequencyMhz.toFixed(3)}</td>
                    <td className="px-3 py-2"><Badge>{d.mode}</Badge></td>
                    <td className="px-3 py-2 text-gray-400 font-mono max-w-xs truncate">{d.message}</td>
                    <td className="px-3 py-2 text-gray-500 font-mono">{d.spotterCallsign}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visible.length === 0 && (
              <p className="p-6 text-gray-500 text-center">
                Ingen decodes endnu. Vent på at WSJT-X sender data via plugin&apos;et.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
