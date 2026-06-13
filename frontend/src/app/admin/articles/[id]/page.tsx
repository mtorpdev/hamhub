'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { useToast } from '@/contexts/ToastContext'
import type { ArticleCategory } from '@/lib/types'

export default function EditArticlePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()
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
      .replace(/[æ]/g, 'ae').replace(/[ø]/g, 'oe').replace(/[å]/g, 'aa')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    setForm(f => ({ ...f, title, slug }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title || !form.slug || !form.content || !form.categoryId) {
      setError('Titel, slug, indhold og kategori er påkrævet')
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
      toast('Artikel gemt!')
      router.push('/admin/articles')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fejl ved gemning')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-10 text-gray-400">Indlæser...</div>

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-white mb-8">Rediger artikel</h1>
      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Titel *</label>
                <Input value={form.title} onChange={e => handleTitleChange(e.target.value)} placeholder="Artikel titel" />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Slug *</label>
                <Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="artikel-slug" className="font-mono" />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Kategori *</label>
                <select
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  value={form.categoryId}
                  onChange={e => setForm(f => ({ ...f, categoryId: Number(e.target.value) }))}
                >
                  <option value={0}>Vælg kategori...</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Resumé</label>
                <Input value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} placeholder="Kort beskrivelse (valgfri)" />
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Indhold *</label>
              <textarea
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm min-h-[300px] resize-y"
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-3">
              <Button type="submit" disabled={saving}>{saving ? 'Gemmer...' : 'Gem ændringer'}</Button>
              <Button type="button" variant="secondary" onClick={() => router.push('/admin/articles')}>Annuller</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
