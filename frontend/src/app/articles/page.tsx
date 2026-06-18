'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import type { Article } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { pageShellClass } from '@/lib/layout'

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.articles.getPublished().then(setArticles).finally(() => setLoading(false))
  }, [])

  return (
    <div className={pageShellClass}>
      <h1 className="text-3xl font-bold text-white mb-2">Nyheder</h1>
      <p className="text-gray-400 mb-8">Seneste amatørradio-nyheder fra HamHub og udvalgte kilder.</p>
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
                      <p className="text-gray-500 text-xs mt-2">
                        {a.categoryName} &bull; {a.sourceName || a.authorCallsign || 'HamHub'} &bull; {formatDate(a.publishDate || a.createdAt)}
                      </p>
                    </div>
                    {a.isExternal && (
                      <span className="shrink-0 rounded border border-blue-500/30 px-2 py-1 text-xs text-blue-300">Ekstern</span>
                    )}
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
