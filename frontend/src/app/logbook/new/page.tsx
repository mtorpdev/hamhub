'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Band, BandLabels, Mode, ModeLabels } from '@/lib/types'

export default function NewQsoPage() {
  const { user } = useAuth()
  const router = useRouter()
  const now = new Date().toISOString().slice(0, 16)
  const [form, setForm] = useState({
    dateUtc: now, ownCallsign: user?.callsign || '', workedCallsign: '',
    band: Band.M20, frequency: '', mode: Mode.SSB,
    rstSent: '59', rstReceived: '59', locator: '', country: '', notes: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.qsos.create({ ...form, dateUtc: new Date(form.dateUtc).toISOString(), frequency: form.frequency ? parseFloat(form.frequency) : undefined })
      router.push('/logbook')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fejl')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-white mb-8">Log ny QSO</h1>
      <Card>
        <CardContent className="py-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Dato/tid UTC *" type="datetime-local" value={form.dateUtc} onChange={set('dateUtc')} required />
              <Input label="Eget kaldesignal *" value={form.ownCallsign} onChange={set('ownCallsign')} required />
            </div>
            <Input label="Kontaktens kaldesignal *" value={form.workedCallsign} onChange={set('workedCallsign')} required placeholder="DL1ABC" />
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
            <Button type="submit" disabled={loading}>{loading ? 'Logger...' : 'Log QSO'}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
