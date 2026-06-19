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
import { ImageDropzone } from '@/components/marketplace/ImageDropzone'
import { pageShellClass } from '@/lib/layout'
import { useLanguage } from '@/i18n/LanguageContext'

export default function NewListingPage() {
  useRequireAuth()
  const router = useRouter()
  const { toast } = useToast()
  const { t } = useLanguage()
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
    if (!form.price || isNaN(Number(form.price))) { setError(t('market.validPrice')); return }
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
      toast(t('market.createSuccess'))
      router.push(`/marketplace/${listing.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('market.createFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={pageShellClass}>
      <h1 className="text-3xl font-bold text-white mb-8">{t('market.createListing')}</h1>
      <Card>
        <CardContent className="py-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label={`${t('market.titleLabel')} *`} value={form.title} onChange={set('title')} required placeholder="e.g. Yaesu FT-991A" />

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-300">{t('market.descriptionLabel')} *</label>
              <textarea
                rows={5}
                value={form.description}
                onChange={set('description')}
                required
                placeholder={t('market.descriptionPlaceholder')}
                className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input label={`${t('market.price')} *`} type="number" min="0" step="1" value={form.price} onChange={set('price')} required placeholder="2500" />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-300">{t('market.currency')}</label>
                <select value={form.currency} onChange={set('currency')} className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white text-sm">
                  <option value="DKK">DKK</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-300">{t('market.category')}</label>
                <select value={form.category} onChange={set('category')} className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white text-sm">
                  {Object.entries(ListingCategoryLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-300">{t('market.condition')}</label>
                <select value={form.condition} onChange={set('condition')} className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white text-sm">
                  {Object.entries(ListingConditionLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>

            <ImageDropzone files={images} onChange={setImages} label={t('market.images')} />

            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-3">
              <Button type="submit" disabled={loading}>{loading ? t('auth.registering') : t('market.createListing')}</Button>
              <Button type="button" variant="secondary" onClick={() => router.push('/marketplace')}>{t('common.cancel')}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
