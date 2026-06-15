'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ListingCategoryLabels, ListingConditionLabels, type Listing } from '@/lib/types'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useToast } from '@/contexts/ToastContext'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

export default function EditListingPage() {
  useRequireAuth()
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()
  const [listing, setListing] = useState<Listing | null>(null)
  const [form, setForm] = useState({ title: '', description: '', price: '', currency: 'DKK', category: 12, condition: 3 })
  const [newImages, setNewImages] = useState<File[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.listings.getById(Number(id)).then(l => {
      setListing(l)
      setForm({ title: l.title, description: l.description, price: l.price.toString(), currency: l.currency, category: l.category, condition: l.condition })
    }).catch(() => router.replace('/marketplace/my')).finally(() => setLoading(false))
  }, [id, router])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.listings.update(Number(id), {
        title: form.title, description: form.description,
        price: parseFloat(form.price), currency: form.currency,
        category: Number(form.category), condition: Number(form.condition),
      })
      for (const file of newImages) {
        try { await api.listings.uploadImage(Number(id), file) } catch { /* continue */ }
      }
      toast('Annonce opdateret!')
      router.push(`/marketplace/${id}`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Fejl', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteImage = async (imageId: number) => {
    try {
      await api.listings.deleteImage(Number(id), imageId)
      setListing(l => l ? { ...l, images: l.images.filter(i => i.id !== imageId) } : l)
    } catch { toast('Kunne ikke slette billede', 'error') }
  }

  if (loading) return <div className="max-w-6xl mx-auto px-4 py-10 text-gray-400">Indlæser...</div>

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-white mb-8">Rediger annonce</h1>
      <Card>
        <CardContent className="py-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label="Titel *" value={form.title} onChange={set('title')} required />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-300">Beskrivelse *</label>
              <textarea rows={5} value={form.description} onChange={set('description')} required className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Pris *" type="number" min="0" value={form.price} onChange={set('price')} required />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-300">Valuta</label>
                <select value={form.currency} onChange={set('currency')} className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white text-sm">
                  <option value="DKK">DKK</option><option value="EUR">EUR</option><option value="USD">USD</option>
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

            {listing && listing.images.length > 0 && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300">Eksisterende billeder</label>
                <div className="flex gap-2 flex-wrap">
                  {listing.images.map(img => (
                    <div key={img.id} className="relative group">
                      <img src={`${API_URL}${img.url}`} alt="" className="w-20 h-16 object-cover rounded" />
                      <button
                        type="button"
                        onClick={() => handleDeleteImage(img.id)}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100"
                      >×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-300">Tilføj billeder</label>
              <input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={e => setNewImages(Array.from(e.target.files || []))} className="text-sm text-gray-400" />
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={saving}>{saving ? 'Gemmer...' : 'Gem ændringer'}</Button>
              <Button type="button" variant="secondary" onClick={() => router.push(`/marketplace/${id}`)}>Annuller</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
