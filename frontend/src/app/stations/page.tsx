'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { BandLabels, ModeLabels, type Station } from '@/lib/types'

export default function StationsPage() {
  const [stations, setStations] = useState<Station[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => api.stations.getMine().then(setStations).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const handleDelete = async (id: number) => {
    if (!confirm('Slet station?')) return
    await api.stations.delete(id)
    load()
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-white">Mine Stationer</h1>
        <Link href="/stations/new"><Button>+ Ny station</Button></Link>
      </div>
      {loading ? <p className="text-gray-400">Indlæser...</p> : (
        <div className="flex flex-col gap-4">
          {stations.map(s => (
            <Card key={s.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{s.name} {s.callsign && <span className="text-blue-400 font-mono ml-2">{s.callsign}</span>}</CardTitle>
                <button onClick={() => handleDelete(s.id)} className="text-red-500 hover:text-red-400 text-sm">Slet</button>
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
          {stations.length === 0 && <p className="text-gray-400">Ingen stationer endnu. <Link href="/stations/new" className="text-blue-400">Opret din første station →</Link></p>}
        </div>
      )}
    </div>
  )
}
