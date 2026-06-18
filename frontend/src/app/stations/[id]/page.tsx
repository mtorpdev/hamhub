'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Band, BandLabels, Mode, ModeLabels, ProfileVisibility, StationType, type Station } from '@/lib/types'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { pageShellClass } from '@/lib/layout'
import { ImageDropzone } from '@/components/marketplace/ImageDropzone'
import { StationTypeLabels, StationVisibilityLabels, stationTypeLabel, stationVisibilityLabel } from '../stationUi'

export default function EditStationPage() {
  useRequireAuth()
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [form, setForm] = useState({ name: '', callsign: '', radioEquipment: '', antennaDescription: '', powerOutput: '', location: '', gridLocator: '', stationType: StationType.HomeShack, description: '', visibility: ProfileVisibility.Private })
  const [station, setStation] = useState<Station | null>(null)
  const [selectedBands, setSelectedBands] = useState<Band[]>([])
  const [selectedModes, setSelectedModes] = useState<Mode[]>([])
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    api.stations.getById(Number(id)).then((s: Station) => {
      setStation(s)
      setForm({
        name: s.name,
        callsign: s.callsign ?? '',
        radioEquipment: s.radioEquipment ?? '',
        antennaDescription: s.antennaDescription ?? '',
        powerOutput: s.powerOutput?.toString() ?? '',
        location: s.location ?? '',
        gridLocator: s.gridLocator ?? '',
        stationType: s.stationType ?? StationType.HomeShack,
        description: s.description ?? '',
        visibility: s.visibility ?? ProfileVisibility.Private,
      })
      setSelectedBands(s.supportedBands)
      setSelectedModes(s.supportedModes)
    }).catch(() => router.replace('/stations')).finally(() => setLoading(false))
  }, [id, router])

  const toggleBand = (b: Band) => setSelectedBands(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b])
  const toggleMode = (m: Mode) => setSelectedModes(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

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
      for (const file of imageFiles) {
        try { await api.stations.uploadImage(Number(id), file) } catch { /* continue */ }
      }
      router.push('/stations')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fejl')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className={`${pageShellClass} text-gray-400`}>Indlæser...</div>

  const deleteImage = async (imageId: number) => {
    if (!id || !confirm('Slet billedet?')) return
    await api.stations.deleteImage(Number(id), imageId)
    const updated = await api.stations.getById(Number(id))
    setStation(updated)
  }

  return (
    <div className={pageShellClass}>
      <h1 className="text-3xl font-bold text-white mb-8">Rediger Station</h1>
      {station && (
        <Card className="mb-6 overflow-hidden">
          {station.images.length > 0 && (
            <div className="grid gap-2 bg-gray-950 p-3 sm:grid-cols-3">
              {station.images.slice(0, 6).map(image => (
                <div key={image.id} className="relative overflow-hidden rounded border border-gray-700">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.url} alt="" className="aspect-video w-full object-cover" />
                  <button type="button" onClick={() => deleteImage(image.id)} className="absolute right-2 top-2 rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700">Slet</button>
                </div>
              ))}
            </div>
          )}
          <CardContent className="py-5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
              <span className="rounded border border-gray-700 px-2 py-1">{stationTypeLabel(station.stationType)}</span>
              <span className="rounded border border-gray-700 px-2 py-1">{stationVisibilityLabel(station.visibility)}</span>
              {station.images.length > 0 && <span className="rounded border border-gray-700 px-2 py-1">{station.images.length} billeder</span>}
            </div>
            {station.description && <p className="mt-3 text-sm text-gray-300">{station.description}</p>}
          </CardContent>
        </Card>
      )}
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
            <ImageDropzone files={imageFiles} onChange={setImageFiles} existingCount={station?.images.length ?? 0} label="Tilføj station billeder" />
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
