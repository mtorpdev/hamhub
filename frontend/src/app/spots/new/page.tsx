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
import { useLanguage } from '@/i18n/LanguageContext'
import { pageShellClass } from '@/lib/layout'

export default function NewSpotPage() {
  useRequireAuth()
  const { toast } = useToast()
  const { t } = useLanguage()
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
      toast(t('spots.sent'))
      router.push('/spots')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('messages.error'))
    } finally {
      setLoading(false)
    }
  }

  const set = (key: string) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(current => ({ ...current, [key]: event.target.value }))

  return (
    <div className={pageShellClass}>
      <h1 className="mb-8 text-3xl font-bold text-white">{t('spots.newTitle')}</h1>
      <Card>
        <CardContent className="py-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label={`${t('spots.callsign')} *`} value={form.callsign} onChange={set('callsign')} required placeholder="VP9/G3XYZ" />
            <Input label={`${t('spots.frequencyMhz')} *`} type="number" step="0.001" value={form.frequency} onChange={set('frequency')} required />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-300">{t('spots.band')}</label>
              <select value={form.band} onChange={set('band')} className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white">
                {Object.entries(BandLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-300">{t('spots.mode')}</label>
              <select value={form.mode} onChange={set('mode')} className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white">
                {Object.entries(ModeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-300">{t('spots.comment')}</label>
              <textarea value={form.comment} onChange={set('comment')} rows={2} className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white" placeholder={t('spots.strongSignalPlaceholder')} />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Button type="submit" disabled={loading}>{loading ? t('spots.sending') : t('spots.send')}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
