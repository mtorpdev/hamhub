'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ListingCategoryLabels, ListingConditionLabels, ListingCategory, ListingCondition } from '@/lib/types'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useToast } from '@/contexts/ToastContext'

export default function NewListingPage() {
  useRequireAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [form, setForm] = useState({
    title: '', description: '', price: '', currency: 'DKK',
    category: ListingCategory.Other, condition: ListingCondition.Good,
  })
  const [images, setImages] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.price || isNaN(Number(form.price))) { setError('Angiv en gyldig pris'); return }
    setLoading(true)
    try {
      const listing = await api.listings.create({
        title: form.title,
        description: form.description,
        price: parseFloat(form.price),
        currency: form.currency,
        category: Number(form.category),
        condition: Number(form.condition),
      })
      // Upload images
      for (const file of images) {
        try { await api.listings.uploadImage(listing.id, file) } catch { /* continue */ }
      }
      toast('Annonce oprettet!')
      router.push(`/marketplace/${listing.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fejl')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-white mb-8">Opret annonce</h1>
      <Card>
        <CardContent className="py-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label="Titel *" value={form.title} onChange={set('title')} required placeholder="f.eks. Yaesu FT-991A" />

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-300">Beskrivelse *</label>
              <textarea
                rows={5}
                value={form.description}
                onChange={set('description')}
                required
                placeholder="Beskriv udstyret, dets tilstand, hvad der medfølger osv."
                className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input label="Pris *" type="number" min="0" step="1" value={form.price} onChange={set('price')} required placeholder="2500" />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-300">Valuta</label>
                <select value={form.currency} onChange={set('currency')} className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white text-sm">
                  <option value="DKK">DKK</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-300">Kategori</label>
                <select value={form.category} onChange={set('category')} className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white text-sm">
                  {Object.entries(ListingCategoryLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-300">Stand</label>
                <select value={form.condition} onChange={set('condition')} className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white text-sm">
                  {Object.entries(ListingConditionLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-300">Billeder (maks 8)</label>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={e => setImages(Array.from(e.target.files || []).slice(0, 8))}
                className="text-sm text-gray-400"
              />
              {images.length > 0 && (
                <p className="text-xs text-gray-500">{images.length} billede(r) valgt</p>
              )}
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-3">
              <Button type="submit" disabled={loading}>{loading ? 'Opretter...' : 'Opret annonce'}</Button>
              <Button type="button" variant="secondary" onClick={() => router.push('/marketplace')}>Annuller</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
