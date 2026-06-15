'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import Link from 'next/link'
import type { Article, ArticleCategory } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { useToast } from '@/contexts/ToastContext'

const emptyForm = { title: '', slug: '', summary: '', content: '', categoryId: 0 }

export default function AdminArticlesPage() {
  const { toast } = useToast()
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
      toast('Artikel udgivet!')
      load()
    } catch {
      toast('Udgivelse mislykkedes', 'error')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Slet artikel?')) return
    try {
      await api.articles.delete(id)
      toast('Artikel slettet')
      load()
    } catch {
      toast('Sletning mislykkedes', 'error')
    }
  }

  const handleImportFeeds = async () => {
    setImporting(true)
    try {
      const result = await api.articles.importFeeds()
      toast(`Importerede ${result.imported} nyheder. Sprang ${result.skipped} over.`)
      load()
    } catch {
      toast('Import af nyheder mislykkedes', 'error')
    } finally {
      setImporting(false)
    }
  }

  const handleTitleChange = (title: string) => {
    const slug = title.toLowerCase()
      .replace(/[æ]/g, 'ae').replace(/[ø]/g, 'oe').replace(/[å]/g, 'aa')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    setForm(f => ({ ...f, title, slug }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title || !form.slug || !form.content || !form.categoryId) {
      setFormError('Titel, slug, indhold og kategori er påkrævet')
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
      toast('Artikel gemt som kladde!')
      load()
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Fejl ved oprettelse')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-white">Artikler</h1>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={handleImportFeeds} disabled={importing}>
            {importing ? 'Henter...' : 'Importer nyheder'}
          </Button>
          <Button onClick={() => { setShowForm(s => !s); setFormError('') }}>
            {showForm ? 'Annuller' : '+ Ny artikel'}
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="mb-8">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Opret artikel</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Titel *</label>
                  <Input
                    value={form.title}
                    onChange={e => handleTitleChange(e.target.value)}
                    placeholder="Artikel titel"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Slug *</label>
                  <Input
                    value={form.slug}
                    onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                    placeholder="artikel-slug"
                    className="font-mono"
                  />
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
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Resumé</label>
                  <Input
                    value={form.summary}
                    onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
                    placeholder="Kort beskrivelse (valgfri)"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Indhold *</label>
                <textarea
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm min-h-[200px] resize-y"
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="Artikelindhold..."
                />
              </div>
              {formError && <p className="text-red-400 text-sm">{formError}</p>}
              <div className="flex gap-3">
                <Button type="submit" disabled={saving}>{saving ? 'Gemmer...' : 'Gem som kladde'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? <p className="p-6 text-gray-400">Indlæser...</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-800/50">
                  <tr>
                    {['Titel', 'Kategori', 'Kilde', 'Status', 'Oprettet', 'Handlinger'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-gray-400 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {articles.map(a => (
                    <tr key={a.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 text-white">{a.title}</td>
                      <td className="px-4 py-3 text-gray-400">{a.categoryName}</td>
                      <td className="px-4 py-3 text-gray-400">{a.sourceName || a.authorCallsign}</td>
                      <td className="px-4 py-3">
                        <Badge variant={a.isPublished ? 'success' : 'warning'}>
                          {a.isPublished ? 'Udgivet' : 'Kladde'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(a.createdAt)}</td>
                      <td className="px-4 py-3 flex gap-2">
                        <Link href={`/admin/articles/${a.id}`} className="text-blue-400 hover:text-blue-300 text-xs">Rediger</Link>
                        {!a.isPublished && (
                          <button onClick={() => handlePublish(a.id)} className="text-green-400 hover:text-green-300 text-xs">Udgiv</button>
                        )}
                        <button onClick={() => handleDelete(a.id)} className="text-red-500 hover:text-red-400 text-xs">Slet</button>
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
