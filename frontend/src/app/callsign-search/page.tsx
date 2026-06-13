'use client'
import { useState } from 'react'
import { api } from '@/lib/api'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { BandLabels, ModeLabels, type User, type Station, type Qso } from '@/lib/types'
import { formatDate } from '@/lib/utils'

export default function CallsignSearchPage() {
  const [callsign, setCallsign] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const [stations, setStations] = useState<Station[]>([])
  const [qsos, setQsos] = useState<Qso[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!callsign.trim()) return
    setLoading(true)
    setError('')
    setUser(null)
    setStations([])
    setQsos([])
    setSearched(true)
    try {
      const users = await api.users.getAll()
      const found = users.find(u => u.callsign?.toLowerCase() === callsign.trim().toLowerCase())
      if (!found) { setError(`Ingen bruger fundet med kaldesignalet ${callsign.toUpperCase()}`); return }
      setUser(found)
      const allStations = await api.stations.getAll()
      setStations(allStations.filter(s => s.userId === found.id))
    } catch {
      setError('Søgning mislykkedes')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-white mb-8">Callsign Lookup</h1>
      <form onSubmit={handleSearch} className="flex gap-3 mb-8">
        <Input className="flex-1" placeholder="F.eks. OZ5ABC" value={callsign} onChange={e => setCallsign(e.target.value.toUpperCase())} />
        <Button type="submit" disabled={loading}>{loading ? 'Søger...' : 'Søg'}</Button>
      </form>

      {error && <p className="text-red-400 mb-6">{error}</p>}

      {user && (
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader><CardTitle>📻 {user.callsign || 'Ukendt'}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-400">Navn: </span><span className="text-white">{user.firstName} {user.lastName}</span></div>
                <div><span className="text-gray-400">Land: </span><span className="text-white">{user.country || '—'}</span></div>
                <div><span className="text-gray-400">Grid: </span><span className="text-white font-mono">{user.gridLocator || '—'}</span></div>
                <div><span className="text-gray-400">Licens: </span><span className="text-white">{user.licenseClass !== null ? user.licenseClass : '—'}</span></div>
                {user.profileDescription && <div className="col-span-2"><span className="text-gray-400">Om: </span><span className="text-white">{user.profileDescription}</span></div>}
              </div>
            </CardContent>
          </Card>

          {stations.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Stationer</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  {stations.map(s => (
                    <div key={s.id} className="text-sm">
                      <p className="font-semibold text-white">{s.name}</p>
                      {s.radioEquipment && <p className="text-gray-400">Udstyr: {s.radioEquipment}</p>}
                      {s.antennaDescription && <p className="text-gray-400">Antenne: {s.antennaDescription}</p>}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {s.supportedBands.map(b => <Badge key={b} variant="info">{BandLabels[b]}</Badge>)}
                        {s.supportedModes.map(m => <Badge key={m}>{ModeLabels[m]}</Badge>)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {searched && !user && !error && !loading && (
        <p className="text-gray-400">Ingen resultater.</p>
      )}
    </div>
  )
}
