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
    rstSent: '', rstReceived: '',
    submode: '', locator: '', myGridsquare: '',
    country: '', dxcc: '', continent: '', state: '', iota: '',
    name: '', qth: '', txPower: '', comment: '',
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
        submode: q.submode ?? '',
        locator: q.locator ?? '',
        myGridsquare: q.myGridsquare ?? '',
        country: q.country ?? '',
        dxcc: q.dxcc?.toString() ?? '',
        continent: q.continent ?? '',
        state: q.state ?? '',
        iota: q.iota ?? '',
        name: q.name ?? '',
        qth: q.qth ?? '',
        txPower: q.txPower?.toString() ?? '',
        comment: q.comment ?? '',
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
        dxcc: form.dxcc ? parseInt(form.dxcc) : undefined,
        txPower: form.txPower ? parseFloat(form.txPower) : undefined,
      })
      toast('QSO gemt!')
      router.push('/logbook')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fejl')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="max-w-3xl mx-auto px-4 py-10 text-gray-400">Indlæser...</div>

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-white mb-8">Rediger QSO</h1>
      <Card>
        <CardContent className="py-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">

            <div className="grid grid-cols-2 gap-3">
              <Input label="Dato/tid UTC *" type="datetime-local" value={form.dateUtc} onChange={set('dateUtc')} required />
              <Input label="Eget kaldesignal *" value={form.ownCallsign} onChange={set('ownCallsign')} required />
            </div>

            <Input label="Kontaktens kaldesignal *" value={form.workedCallsign} onChange={set('workedCallsign')} required />

            <div className="grid grid-cols-3 gap-3">
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
              <Input label="Submode" value={form.submode} onChange={set('submode')} placeholder="USB, LSB, JT65..." />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Input label="Frekvens (MHz)" type="number" step="0.001" value={form.frequency} onChange={set('frequency')} />
              <Input label="RST Sendt" value={form.rstSent} onChange={set('rstSent')} />
              <Input label="RST Modtaget" value={form.rstReceived} onChange={set('rstReceived')} />
            </div>

            <div className="border-t border-gray-700 pt-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Lokation</p>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Kontaktens Grid Locator" value={form.locator} onChange={set('locator')} placeholder="JO55WM" />
                <Input label="Mit Grid Locator" value={form.myGridsquare} onChange={set('myGridsquare')} placeholder="JO65DQ" />
              </div>
            </div>

            <div className="border-t border-gray-700 pt-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">DX-info</p>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Land" value={form.country} onChange={set('country')} />
                <Input label="DXCC" type="number" value={form.dxcc} onChange={set('dxcc')} placeholder="291" />
              </div>
              <div className="grid grid-cols-3 gap-3 mt-3">
                <Input label="Kontinent" value={form.continent} onChange={set('continent')} placeholder="EU" />
                <Input label="Stat/Provins" value={form.state} onChange={set('state')} placeholder="CA" />
                <Input label="IOTA" value={form.iota} onChange={set('iota')} placeholder="EU-030" />
              </div>
            </div>

            <div className="border-t border-gray-700 pt-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Operatøroplysninger</p>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Navn" value={form.name} onChange={set('name')} />
                <Input label="QTH" value={form.qth} onChange={set('qth')} />
              </div>
              <div className="mt-3">
                <Input label="TX Effekt (W)" type="number" step="0.1" value={form.txPower} onChange={set('txPower')} />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-300">Kommentar</label>
              <textarea rows={2} value={form.comment} onChange={set('comment')} className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white text-sm" />
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
