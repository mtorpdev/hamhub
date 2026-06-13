'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Band, BandLabels, Mode, ModeLabels, type Station } from '@/lib/types'
import { useRequireAuth } from '@/hooks/useRequireAuth'

export default function EditStationPage() {
  useRequireAuth()
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [form, setForm] = useState({ name: '', callsign: '', radioEquipment: '', antennaDescription: '', powerOutput: '', location: '', gridLocator: '' })
  const [selectedBands, setSelectedBands] = useState<Band[]>([])
  const [selectedModes, setSelectedModes] = useState<Mode[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    api.stations.getById(Number(id)).then((s: Station) => {
      setForm({
        name: s.name,
        callsign: s.callsign ?? '',
        radioEquipment: s.radioEquipment ?? '',
        antennaDescription: s.antennaDescription ?? '',
        powerOutput: s.powerOutput?.toString() ?? '',
        location: s.location ?? '',
        gridLocator: s.gridLocator ?? '',
      })
      setSelectedBands(s.supportedBands)
      setSelectedModes(s.supportedModes)
    }).catch(() => router.replace('/stations')).finally(() => setLoading(false))
  }, [id, router])

  const toggleBand = (b: Band) => setSelectedBands(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b])
  const toggleMode = (m: Mode) => setSelectedModes(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await api.stations.update(Number(id), {
        ...form,
        powerOutput: form.powerOutput ? parseInt(form.powerOutput) : undefined,
        supportedBands: selectedBands,
        supportedModes: selectedModes,
      })
      router.push('/stations')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fejl')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="max-w-xl mx-auto px-4 py-10 text-gray-400">Indlæser...</div>

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-white mb-8">Rediger Station</h1>
      <Card>
        <CardContent className="py-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label="Stationsnavn *" value={form.name} onChange={set('name')} required />
            <Input label="Kaldesignal" value={form.callsign} onChange={set('callsign')} placeholder="OZ1ABC" />
            <Input label="Radioudstyr" value={form.radioEquipment} onChange={set('radioEquipment')} placeholder="Icom IC-7300" />
            <Input label="Antennebeskrivelse" value={form.antennaDescription} onChange={set('antennaDescription')} />
            <Input label="Effekt (W)" type="number" value={form.powerOutput} onChange={set('powerOutput')} />
            <Input label="Placering" value={form.location} onChange={set('location')} />
            <Input label="Grid Locator" value={form.gridLocator} onChange={set('gridLocator')} placeholder="JO55WM" />
            <div>
              <p className="text-sm font-medium text-gray-300 mb-2">Bånd</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(BandLabels).map(([v, l]) => {
                  const b = parseInt(v) as Band
                  return <button key={v} type="button" onClick={() => toggleBand(b)} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${selectedBands.includes(b) ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>{l}</button>
                })}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-300 mb-2">Modes</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(ModeLabels).map(([v, l]) => {
                  const m = parseInt(v) as Mode
                  return <button key={v} type="button" onClick={() => toggleMode(m)} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${selectedModes.includes(m) ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>{l}</button>
                })}
              </div>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-3">
              <Button type="submit" disabled={saving}>{saving ? 'Gemmer...' : 'Gem ændringer'}</Button>
              <Button type="button" variant="secondary" onClick={() => router.push('/stations')}>Annuller</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
