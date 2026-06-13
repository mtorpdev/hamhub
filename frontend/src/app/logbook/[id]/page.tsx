'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Band, BandLabels, Mode, ModeLabels, type Qso } from '@/lib/types'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useToast } from '@/contexts/ToastContext'

export default function EditQsoPage() {
  useRequireAuth()
  const { toast } = useToast()
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [form, setForm] = useState({
    dateUtc: '', ownCallsign: '', workedCallsign: '',
    band: Band.M20, frequency: '', mode: Mode.SSB,
    rstSent: '', rstReceived: '', locator: '', country: '', notes: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    api.qsos.getById(Number(id)).then((q: Qso) => {
      setForm({
        dateUtc: new Date(q.dateUtc).toISOString().slice(0, 16),
        ownCallsign: q.ownCallsign,
        workedCallsign: q.workedCallsign,
        band: q.band,
        frequency: q.frequency?.toString() ?? '',
        mode: q.mode,
        rstSent: q.rstSent ?? '',
        rstReceived: q.rstReceived ?? '',
        locator: q.locator ?? '',
        country: q.country ?? '',
        notes: q.notes ?? '',
      })
    }).catch(() => router.replace('/logbook')).finally(() => setLoading(false))
  }, [id, router])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await api.qsos.update(Number(id), {
        ...form,
        dateUtc: new Date(form.dateUtc).toISOString(),
        frequency: form.frequency ? parseFloat(form.frequency) : undefined,
      })
      toast('QSO gemt!')
      router.push('/logbook')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fejl')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="max-w-2xl mx-auto px-4 py-10 text-gray-400">Indlæser...</div>

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-white mb-8">Rediger QSO</h1>
      <Card>
        <CardContent className="py-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Dato/tid UTC *" type="datetime-local" value={form.dateUtc} onChange={set('dateUtc')} required />
              <Input label="Eget kaldesignal *" value={form.ownCallsign} onChange={set('ownCallsign')} required />
            </div>
            <Input label="Kontaktens kaldesignal *" value={form.workedCallsign} onChange={set('workedCallsign')} required />
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-300">Band</label>
                <select value={form.band} onChange={set('band')} className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white text-sm">
                  {Object.entries(BandLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-300">Mode</label>
                <select value={form.mode} onChange={set('mode')} className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white text-sm">
                  {Object.entries(ModeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Input label="Frekvens (MHz)" type="number" step="0.001" value={form.frequency} onChange={set('frequency')} />
              <Input label="RST Sendt" value={form.rstSent} onChange={set('rstSent')} />
              <Input label="RST Modtaget" value={form.rstReceived} onChange={set('rstReceived')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Grid Locator" value={form.locator} onChange={set('locator')} placeholder="JO55WM" />
              <Input label="Land" value={form.country} onChange={set('country')} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-300">Noter</label>
              <textarea rows={2} value={form.notes} onChange={set('notes')} className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white text-sm" />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-3">
              <Button type="submit" disabled={saving}>{saving ? 'Gemmer...' : 'Gem ændringer'}</Button>
              <Button type="button" variant="secondary" onClick={() => router.push('/logbook')}>Annuller</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
