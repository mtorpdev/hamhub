'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import type { Article } from '@/lib/types'
import { formatDate } from '@/lib/utils'

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.articles.getPublished().then(setArticles).finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-white mb-8">Artikler</h1>
      {loading ? <p className="text-gray-400">Indlæser...</p> : (
        <div className="flex flex-col gap-4">
          {articles.map(a => (
            <Link key={a.id} href={`/articles/${a.slug}`}>
              <Card className="hover:border-blue-600 transition-colors">
                <CardContent className="py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-white">{a.title}</h2>
                      {a.summary && <p className="text-gray-400 text-sm mt-1">{a.summary}</p>}
                      <p className="text-gray-500 text-xs mt-2">{a.categoryName} &bull; {a.authorCallsign} &bull; {formatDate(a.createdAt)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {articles.length === 0 && <p className="text-gray-400">Ingen artikler endnu.</p>}
        </div>
      )}
    </div>
  )
}
