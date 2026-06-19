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
import { useLanguage } from '@/i18n/LanguageContext'
import { ImageDropzone } from '@/components/marketplace/ImageDropzone'
import { pageShellClass } from '@/lib/layout'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.hamhub.dk'

export default function EditListingPage() {
  useRequireAuth()
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()
  const { t } = useLanguage()
  const [listing, setListing] = useState<Listing | null>(null)
  const [form, setForm] = useState({ title: '', description: '', price: '', currency: 'DKK', category: 12, condition: 3 })
  const [newImages, setNewImages] = useState<File[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.listings.getById(Number(id)).then(l => {
      setListing(l)
      setForm({
        title: l.title,
        description: l.description,
        price: l.price.toString(),
        currency: l.currency,
        category: l.category,
        condition: l.condition,
      })
    }).catch(() => router.replace('/marketplace/my')).finally(() => setLoading(false))
  }, [id, router])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.listings.update(Number(id), {
        title: form.title,
        description: form.description,
        price: parseFloat(form.price),
        currency: form.currency,
        category: Number(form.category),
        condition: Number(form.condition),
      })
      for (const file of newImages) {
        try { await api.listings.uploadImage(Number(id), file) } catch { /* continue */ }
      }
      toast(t('market.updateSuccess'))
      router.push(`/marketplace/${id}`)
    } catch (err) {
      toast(err instanceof Error ? err.message : t('market.updateFailed'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteImage = async (imageId: number) => {
    try {
      await api.listings.deleteImage(Number(id), imageId)
      setListing(l => l ? { ...l, images: l.images.filter(i => i.id !== imageId) } : l)
    } catch {
      toast(t('market.deleteImageFailed'), 'error')
    }
  }

  if (loading) return <div className={`${pageShellClass} text-gray-400`}>{t('common.loading')}</div>

  return (
    <div className={pageShellClass}>
      <h1 className="mb-8 text-3xl font-bold text-white">{t('market.updateListing')}</h1>
      <Card>
        <CardContent className="py-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label={`${t('market.titleLabel')} *`} value={form.title} onChange={set('title')} required />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-300">{`${t('market.descriptionLabel')} *`}</label>
              <textarea rows={5} value={form.description} onChange={set('description')} required className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label={`${t('market.price')} *`} type="number" min="0" value={form.price} onChange={set('price')} required />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-300">{t('market.currency')}</label>
                <select value={form.currency} onChange={set('currency')} className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white">
                  <option value="DKK">DKK</option><option value="EUR">EUR</option><option value="USD">USD</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-300">{t('market.category')}</label>
                <select value={form.category} onChange={set('category')} className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white">
                  {Object.entries(ListingCategoryLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-300">{t('market.condition')}</label>
                <select value={form.condition} onChange={set('condition')} className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white">
                  {Object.entries(ListingConditionLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>

            {listing && listing.images.length > 0 && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300">{t('market.existingImages')}</label>
                <div className="flex flex-wrap gap-2">
                  {listing.images.map(img => (
                    <div key={img.id} className="group relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`${API_URL}${img.url}`} alt="" className="h-16 w-20 rounded object-cover" />
                      <button
                        type="button"
                        onClick={() => handleDeleteImage(img.id)}
                        aria-label={t('common.delete')}
                        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs text-white opacity-0 group-hover:opacity-100"
                      >x</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <ImageDropzone
              files={newImages}
              onChange={setNewImages}
              existingCount={listing?.images.length ?? 0}
              label={t('market.addImages')}
            />

            <div className="flex gap-3">
              <Button type="submit" disabled={saving}>{saving ? t('common.saving') : t('market.updateListing')}</Button>
              <Button type="button" variant="secondary" onClick={() => router.push(`/marketplace/${id}`)}>{t('common.cancel')}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
