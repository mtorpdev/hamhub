'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { Article } from '@/lib/types'
import { formatDate } from '@/lib/utils'

export default function AdminArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => api.articles.getAll().then(setArticles).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const handlePublish = async (id: number) => {
    await api.articles.publish(id)
    load()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Slet artikel?')) return
    await api.articles.delete(id)
    load()
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-white mb-8">Artikler</h1>
      <Card>
        <CardContent className="p-0">
          {loading ? <p className="p-6 text-gray-400">Indlæser...</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-800/50">
                  <tr>
                    {['Titel', 'Kategori', 'Forfatter', 'Status', 'Oprettet', 'Handlinger'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-gray-400 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {articles.map(a => (
                    <tr key={a.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 text-white">{a.title}</td>
                      <td className="px-4 py-3 text-gray-400">{a.categoryName}</td>
                      <td className="px-4 py-3 text-gray-400 font-mono">{a.authorCallsign}</td>
                      <td className="px-4 py-3">
                        <Badge variant={a.isPublished ? 'success' : 'warning'}>
                          {a.isPublished ? 'Udgivet' : 'Kladde'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(a.createdAt)}</td>
                      <td className="px-4 py-3 flex gap-2">
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
