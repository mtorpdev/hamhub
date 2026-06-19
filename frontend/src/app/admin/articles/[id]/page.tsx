'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { useToast } from '@/contexts/ToastContext'
import { useLanguage } from '@/i18n/LanguageContext'
import type { ArticleCategory } from '@/lib/types'
import { pageShellClass } from '@/lib/layout'

export default function EditArticlePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()
  const { t } = useLanguage()
  const [form, setForm] = useState({ title: '', slug: '', summary: '', content: '', categoryId: 0 })
  const [categories, setCategories] = useState<ArticleCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      api.articles.getById(Number(id)),
      api.articles.getCategories(),
    ]).then(([article, cats]) => {
      setForm({
        title: article.title,
        slug: article.slug,
        summary: article.summary ?? '',
        content: article.content,
        categoryId: article.categoryId,
      })
      setCategories(cats)
    }).catch(() => router.replace('/admin/articles')).finally(() => setLoading(false))
  }, [id, router])

  const handleTitleChange = (title: string) => {
    const slug = title.toLowerCase()
      .replace(/[\u00e6]/g, 'ae').replace(/[\u00f8]/g, 'oe').replace(/[\u00e5]/g, 'aa')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    setForm((current) => ({ ...current, title, slug }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.title || !form.slug || !form.content || !form.categoryId) {
      setError(t('admin.articles.requiredError'))
      return
    }
    setSaving(true)
    setError('')
    try {
      await api.articles.update(Number(id), {
        title: form.title,
        slug: form.slug,
        summary: form.summary || undefined,
        content: form.content,
        categoryId: form.categoryId,
      })
      toast(t('admin.articles.savedToast'))
      router.push('/admin/articles')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('admin.articles.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className={`${pageShellClass} text-gray-400`}>{t('common.loading')}</div>

  return (
    <div className={pageShellClass}>
      <h1 className="text-3xl font-bold text-white mb-8">{t('admin.articles.editTitle')}</h1>
      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">{t('admin.articles.titleLabel')} *</label>
                <Input value={form.title} onChange={(event) => handleTitleChange(event.target.value)} placeholder={t('admin.articles.titlePlaceholder')} />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">{t('admin.articles.slugLabel')} *</label>
                <Input value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} placeholder="article-slug" className="font-mono" />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">{t('admin.articles.categoryLabel')} *</label>
                <select
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  value={form.categoryId}
                  onChange={(event) => setForm((current) => ({ ...current, categoryId: Number(event.target.value) }))}
                >
                  <option value={0}>{t('admin.articles.chooseCategory')}</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">{t('admin.articles.summaryLabel')}</label>
                <Input value={form.summary} onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))} placeholder={t('admin.articles.summaryPlaceholder')} />
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">{t('admin.articles.contentLabel')} *</label>
              <textarea
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm min-h-[300px] resize-y"
                value={form.content}
                onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-3">
              <Button type="submit" disabled={saving}>{saving ? t('common.saving') : t('admin.articles.saveChanges')}</Button>
              <Button type="button" variant="secondary" onClick={() => router.push('/admin/articles')}>{t('common.cancel')}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
