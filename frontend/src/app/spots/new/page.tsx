'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Band, BandLabels, Mode, ModeLabels } from '@/lib/types'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useToast } from '@/contexts/ToastContext'
import { pageShellClass } from '@/lib/layout'

export default function NewSpotPage() {
  useRequireAuth()
  const { toast } = useToast()
  const [form, setForm] = useState({ callsign: '', frequency: '', band: Band.M20, mode: Mode.FT8, comment: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.spots.create({ ...form, frequency: parseFloat(form.frequency) })
      toast('Spot sendt!')
      router.push('/spots')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fejl')
    } finally {
      setLoading(false)
    }
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className={pageShellClass}>
      <h1 className="text-3xl font-bold text-white mb-8">Nyt DX Spot</h1>
      <Card>
        <CardContent className="py-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label="Kaldesignal *" value={form.callsign} onChange={set('callsign')} required placeholder="VP9/G3XYZ" />
            <Input label="Frekvens (MHz) *" type="number" step="0.001" value={form.frequency} onChange={set('frequency')} required />
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
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-300">Kommentar</label>
              <textarea value={form.comment} onChange={set('comment')} rows={2} className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white text-sm" placeholder="Stærkt signal 59+" />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <Button type="submit" disabled={loading}>{loading ? 'Sender...' : 'Send spot'}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
