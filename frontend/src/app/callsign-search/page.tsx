'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { BandLabels, ModeLabels, type User, type Station } from '@/lib/types'
import { type QrzCallsignInfo } from '@/lib/types'
import { pageShellClass } from '@/lib/layout'

export default function CallsignSearchPage() {
  const [callsign, setCallsign] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const [stations, setStations] = useState<Station[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [qrzInfo, setQrzInfo] = useState<QrzCallsignInfo | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (callsign.length < 3) {
      debounceRef.current = setTimeout(() => setQrzInfo(null), 0)
      return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const info = await api.qrz.lookup(callsign)
        setQrzInfo(info)
      } catch {
        setQrzInfo(null)
      }
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [callsign])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!callsign.trim()) return
    setLoading(true)
    setError('')
    setUser(null)
    setStations([])
    setSearched(true)
    try {
      const found = await api.users.searchByCallsign(callsign.trim())
      setUser(found)
      const allStations = await api.stations.getAll()
      setStations(allStations.filter(s => s.userId === found.id))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('404') || msg.includes('HTTP 404')) {
        setError(`Ingen bruger fundet med kaldesignalet ${callsign.toUpperCase()}`)
      } else {
        setError('Søgning mislykkedes')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={pageShellClass}>
      <h1 className="text-3xl font-bold text-white mb-8">Callsign Lookup</h1>
      <form onSubmit={handleSearch} className="flex gap-3 mb-8">
        <Input className="flex-1" placeholder="F.eks. OZ5ABC" value={callsign} onChange={e => setCallsign(e.target.value.toUpperCase())} />
        <Button type="submit" disabled={loading}>{loading ? 'Søger...' : 'Søg'}</Button>
      </form>

      {error && <p className="text-red-400 mb-6">{error}</p>}

      {user && (
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>📻 {user.callsign || 'Ukendt'}</CardTitle>
              {user.callsign && <Link href={`/users/${user.callsign}`} className="text-blue-400 hover:text-blue-300 text-sm">Se profil →</Link>}
            </CardHeader>
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

      {qrzInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              QRZ: {qrzInfo.callsign}
              {qrzInfo.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrzInfo.imageUrl} alt={qrzInfo.callsign} className="h-10 w-10 rounded-full object-cover" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {qrzInfo.name && <div><span className="text-gray-400">Navn: </span><span className="text-white">{qrzInfo.name}</span></div>}
              {qrzInfo.country && <div><span className="text-gray-400">Land: </span><span className="text-white">{qrzInfo.country}</span></div>}
              {qrzInfo.grid && <div><span className="text-gray-400">Grid: </span><span className="text-white font-mono">{qrzInfo.grid}</span></div>}
              {qrzInfo.dxcc && <div><span className="text-gray-400">DXCC: </span><span className="text-white">{qrzInfo.dxcc}</span></div>}
              {qrzInfo.qslVia && <div><span className="text-gray-400">QSL via: </span><span className="text-white">{qrzInfo.qslVia}</span></div>}
              {qrzInfo.email && <div><span className="text-gray-400">Email: </span><span className="text-white">{qrzInfo.email}</span></div>}
            </div>
          </CardContent>
        </Card>
      )}

      {searched && !user && !error && !loading && (
        <p className="text-gray-400">Ingen resultater.</p>
      )}
    </div>
  )
}
