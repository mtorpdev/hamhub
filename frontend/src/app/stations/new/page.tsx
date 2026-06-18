'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Band, BandLabels, Mode, ModeLabels, ProfileVisibility, StationType } from '@/lib/types'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useToast } from '@/contexts/ToastContext'
import { pageShellClass } from '@/lib/layout'
import { ImageDropzone } from '@/components/marketplace/ImageDropzone'
import { StationTypeLabels, StationVisibilityLabels } from '../stationUi'

export default function NewStationPage() {
  useRequireAuth()
  const { toast } = useToast()
  const [form, setForm] = useState({
    name: '',
    callsign: '',
    radioEquipment: '',
    antennaDescription: '',
    powerOutput: '',
    location: '',
    gridLocator: '',
    stationType: StationType.HomeShack,
    description: '',
    visibility: ProfileVisibility.Private,
  })
  const [selectedBands, setSelectedBands] = useState<Band[]>([])
  const [selectedModes, setSelectedModes] = useState<Mode[]>([])
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const toggleBand = (b: Band) => setSelectedBands(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b])
  const toggleMode = (m: Mode) => setSelectedModes(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const station = await api.stations.create({ ...form, powerOutput: form.powerOutput ? parseInt(form.powerOutput) : undefined, supportedBands: selectedBands, supportedModes: selectedModes })
      for (const file of imageFiles) {
        try { await api.stations.uploadImage(station.id, file) } catch { /* continue */ }
      }
      toast('Station oprettet!')
      router.push('/stations')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fejl')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={pageShellClass}>
      <h1 className="text-3xl font-bold text-white mb-8">Ny Station</h1>
      <Card>
        <CardContent className="py-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label="Stationsnavn *" value={form.name} onChange={set('name')} required />
            <Input label="Kaldesignal" value={form.callsign} onChange={set('callsign')} placeholder="OZ1ABC" />
            <Input label="Radioudstyr" value={form.radioEquipment} onChange={set('radioEquipment')} placeholder="Icom IC-7300" />
            <Input label="Antennebeskrivelse" value={form.antennaDescription} onChange={set('antennaDescription')} placeholder="Dipol 20m" />
            <Input label="Effekt (W)" type="number" value={form.powerOutput} onChange={set('powerOutput')} />
            <Input label="Placering" value={form.location} onChange={set('location')} />
            <Input label="Grid Locator" value={form.gridLocator} onChange={set('gridLocator')} placeholder="JO55WM" />
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">Stationstype</label>
              <select value={form.stationType} onChange={event => setForm(current => ({ ...current, stationType: Number(event.target.value) as StationType }))} className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white">
                {Object.entries(StationTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">Synlighed</label>
              <select value={form.visibility} onChange={event => setForm(current => ({ ...current, visibility: Number(event.target.value) as ProfileVisibility }))} className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white">
                {Object.entries(StationVisibilityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">Beskrivelse</label>
              <textarea value={form.description} onChange={set('description')} rows={5} placeholder="Fortæl om dit shack, udstyr, antenner og hvordan stationen bruges." className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-600" />
            </div>
            <ImageDropzone files={imageFiles} onChange={setImageFiles} label="Station billeder" />
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
            <Button type="submit" disabled={loading}>{loading ? 'Opretter...' : 'Opret station'}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
