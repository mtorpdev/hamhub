'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { Article, ArticleCategory } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { useToast } from '@/contexts/ToastContext'
import { useLanguage } from '@/i18n/LanguageContext'
import { pageShellClass } from '@/lib/layout'

const emptyForm = { title: '', slug: '', summary: '', content: '', categoryId: 0 }

export default function AdminArticlesPage() {
  const { toast } = useToast()
  const { t } = useLanguage()
  const [articles, setArticles] = useState<Article[]>([])
  const [categories, setCategories] = useState<ArticleCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [formError, setFormError] = useState('')

  const load = () => api.articles.getAll().then(setArticles).finally(() => setLoading(false))

  useEffect(() => {
    load()
    api.articles.getCategories().then(setCategories)
  }, [])

  const handlePublish = async (id: number) => {
    try {
      await api.articles.publish(id)
      toast(t('admin.articles.publishedToast'))
      load()
    } catch {
      toast(t('admin.articles.publishFailed'), 'error')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm(t('admin.articles.deleteConfirm'))) return
    try {
      await api.articles.delete(id)
      toast(t('admin.articles.deletedToast'))
      load()
    } catch {
      toast(t('admin.articles.deleteFailed'), 'error')
    }
  }

  const handleImportFeeds = async () => {
    setImporting(true)
    try {
      const result = await api.articles.importFeeds()
      toast(t('admin.articles.importedToast', { imported: result.imported, skipped: result.skipped }))
      load()
    } catch {
      toast(t('admin.articles.importFailed'), 'error')
    } finally {
      setImporting(false)
    }
  }

  const handleTitleChange = (title: string) => {
    const slug = title.toLowerCase()
      .replace(/[\u00e6]/g, 'ae').replace(/[\u00f8]/g, 'oe').replace(/[\u00e5]/g, 'aa')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    setForm((current) => ({ ...current, title, slug }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.title || !form.slug || !form.content || !form.categoryId) {
      setFormError(t('admin.articles.requiredError'))
      return
    }
    setSaving(true)
    setFormError('')
    try {
      await api.articles.create({
        title: form.title,
        slug: form.slug,
        summary: form.summary || undefined,
        content: form.content,
        categoryId: form.categoryId,
      })
      setForm(emptyForm)
      setShowForm(false)
      toast(t('admin.articles.draftSavedToast'))
      load()
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : t('admin.articles.createFailed'))
    } finally {
      setSaving(false)
    }
  }

  const headers = [
    t('admin.articles.titleColumn'),
    t('admin.articles.categoryColumn'),
    t('admin.articles.sourceColumn'),
    t('admin.articles.statusColumn'),
    t('admin.articles.createdColumn'),
    t('admin.articles.actionsColumn'),
  ]

  return (
    <div className={pageShellClass}>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-white">{t('admin.articles.title')}</h1>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={handleImportFeeds} disabled={importing}>
            {importing ? t('common.loading') : t('admin.articles.importNews')}
          </Button>
          <Button onClick={() => { setShowForm((visible) => !visible); setFormError('') }}>
            {showForm ? t('common.cancel') : t('admin.articles.newArticle')}
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="mb-8">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">{t('admin.articles.createTitle')}</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">{t('admin.articles.titleLabel')} *</label>
                  <Input
                    value={form.title}
                    onChange={(event) => handleTitleChange(event.target.value)}
                    placeholder={t('admin.articles.titlePlaceholder')}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">{t('admin.articles.slugLabel')} *</label>
                  <Input
                    value={form.slug}
                    onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
                    placeholder="article-slug"
                    className="font-mono"
                  />
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
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">{t('admin.articles.summaryLabel')}</label>
                  <Input
                    value={form.summary}
                    onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
                    placeholder={t('admin.articles.summaryPlaceholder')}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">{t('admin.articles.contentLabel')} *</label>
                <textarea
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm min-h-[200px] resize-y"
                  value={form.content}
                  onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
                  placeholder={t('admin.articles.contentPlaceholder')}
                />
              </div>
              {formError && <p className="text-red-400 text-sm">{formError}</p>}
              <div className="flex gap-3">
                <Button type="submit" disabled={saving}>{saving ? t('common.saving') : t('admin.articles.saveDraft')}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? <p className="p-6 text-gray-400">{t('common.loading')}</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-800/50">
                  <tr>
                    {headers.map((header) => (
                      <th key={header} className="px-4 py-3 text-left text-gray-400 font-medium">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {articles.map((article) => (
                    <tr key={article.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 text-white">{article.title}</td>
                      <td className="px-4 py-3 text-gray-400">{article.categoryName}</td>
                      <td className="px-4 py-3 text-gray-400">{article.sourceName || article.authorCallsign}</td>
                      <td className="px-4 py-3">
                        <Badge variant={article.isPublished ? 'success' : 'warning'}>
                          {article.isPublished ? t('admin.articles.published') : t('admin.articles.draft')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(article.createdAt)}</td>
                      <td className="px-4 py-3 flex gap-2">
                        <Link href={`/admin/articles/${article.id}`} className="text-blue-400 hover:text-blue-300 text-xs">{t('common.edit')}</Link>
                        {!article.isPublished && (
                          <button onClick={() => handlePublish(article.id)} className="text-green-400 hover:text-green-300 text-xs">{t('admin.articles.publish')}</button>
                        )}
                        <button onClick={() => handleDelete(article.id)} className="text-red-500 hover:text-red-400 text-xs">{t('common.delete')}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
