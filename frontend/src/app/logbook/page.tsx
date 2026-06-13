'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { BandLabels, ModeLabels, type Qso } from '@/lib/types'
import { formatUtcDate } from '@/lib/utils'

export default function LogbookPage() {
  const [qsos, setQsos] = useState<Qso[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const load = (s?: string) => {
    setLoading(true)
    api.qsos.getMine(s).then(setQsos).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id: number) => {
    if (!confirm('Slet QSO?')) return
    await api.qsos.delete(id)
    load(search)
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">QSO Logbog</h1>
        <Link href="/logbook/new"><Button>+ Ny QSO</Button></Link>
      </div>
      <div className="flex gap-3 mb-6">
        <Input className="max-w-sm" placeholder="Søg kaldesignal..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load(search)} />
        <Button variant="secondary" onClick={() => load(search)}>Søg</Button>
        {search && <Button variant="ghost" onClick={() => { setSearch(''); load() }}>Ryd</Button>}
      </div>
      <Card>
        <CardContent className="p-0">
          {loading ? <p className="p-6 text-gray-400">Indlæser...</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-800/50">
                  <tr>
                    {['Dato/tid (UTC)', 'Eget kald', 'Kontakt', 'Band', 'Mode', 'RST S/R', 'Land', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-gray-400 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {qsos.map(q => (
                    <tr key={q.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{formatUtcDate(q.dateUtc)}</td>
                      <td className="px-4 py-3 font-mono text-gray-300">{q.ownCallsign}</td>
                      <td className="px-4 py-3 font-mono font-bold text-white">{q.workedCallsign}</td>
                      <td className="px-4 py-3"><Badge variant="info">{BandLabels[q.band]}</Badge></td>
                      <td className="px-4 py-3"><Badge>{ModeLabels[q.mode]}</Badge></td>
                      <td className="px-4 py-3 text-gray-400">{q.rstSent}/{q.rstReceived}</td>
                      <td className="px-4 py-3 text-gray-400">{q.country || '—'}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleDelete(q.id)} className="text-red-500 hover:text-red-400 text-xs">Slet</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {qsos.length === 0 && <p className="p-6 text-gray-400">Ingen QSOer. <Link href="/logbook/new" className="text-blue-400">Log din første QSO →</Link></p>}
            </div>
          )}
        </CardContent>
      </Card>
      <p className="text-gray-500 text-sm mt-3">{qsos.length} QSOer</p>
    </div>
  )
}
