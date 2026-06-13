'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { BandLabels, ModeLabels, type DxSpot } from '@/lib/types'
import { formatDate } from '@/lib/utils'

export function HomeSpotsSection() {
  const [spots, setSpots] = useState<DxSpot[]>([])

  useEffect(() => {
    api.spots.getLatest(8).then(setSpots).catch(() => {})
  }, [])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Seneste DX Spots</CardTitle>
        <Link href="/spots" className="text-sm text-blue-400 hover:text-blue-300">Se alle →</Link>
      </CardHeader>
      <CardContent className="p-0">
        {spots.length === 0 ? (
          <p className="px-6 py-4 text-gray-500 text-sm">Ingen spots endnu</p>
        ) : (
          <div className="divide-y divide-gray-700">
            {spots.map(s => (
              <div key={s.id} className="px-6 py-3 flex items-center justify-between gap-2">
                <div>
                  <span className="font-mono font-bold text-white">{s.callsign}</span>
                  <span className="text-gray-400 text-xs ml-2">{s.frequency.toFixed(3)} MHz</span>
                  {s.comment && <p className="text-gray-500 text-xs mt-0.5">{s.comment}</p>}
                </div>
                <div className="flex gap-1.5 items-center shrink-0">
                  <Badge variant="info">{BandLabels[s.band]}</Badge>
                  <Badge>{ModeLabels[s.mode]}</Badge>
                  <span className="text-gray-600 text-xs hidden sm:block">{formatDate(s.spottedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
