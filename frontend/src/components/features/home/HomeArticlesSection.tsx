'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import type { Article } from '@/lib/types'
import { formatDate } from '@/lib/utils'

export function HomeArticlesSection() {
  const [articles, setArticles] = useState<Article[]>([])

  useEffect(() => {
    api.articles.getPublished().then(a => setArticles(a.slice(0, 5))).catch(() => {})
  }, [])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Seneste Artikler</CardTitle>
        <Link href="/articles" className="text-sm text-blue-400 hover:text-blue-300">Se alle →</Link>
      </CardHeader>
      <CardContent className="p-0">
        {articles.length === 0 ? (
          <p className="px-6 py-4 text-gray-500 text-sm">Ingen artikler endnu</p>
        ) : (
          <div className="divide-y divide-gray-700">
            {articles.map(a => (
              <Link key={a.id} href={`/articles/${a.slug}`} className="block px-6 py-3 hover:bg-gray-700/30 transition-colors">
                <h4 className="font-medium text-white text-sm">{a.title}</h4>
                {a.summary && <p className="text-gray-500 text-xs mt-0.5 line-clamp-1">{a.summary}</p>}
                <p className="text-gray-600 text-xs mt-1">{a.categoryName} &bull; {formatDate(a.createdAt)}</p>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
