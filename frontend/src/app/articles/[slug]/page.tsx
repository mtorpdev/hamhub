'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import type { Article } from '@/lib/types'
import { formatDate } from '@/lib/utils'

export default function ArticlePage() {
  const { slug } = useParams<{ slug: string }>()
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (slug) api.articles.getBySlug(slug).then(setArticle).catch(() => {}).finally(() => setLoading(false))
  }, [slug])

  if (loading) return <div className="max-w-3xl mx-auto px-4 py-10 text-gray-400">Indlæser...</div>
  if (!article) return <div className="max-w-3xl mx-auto px-4 py-10 text-gray-400">Artikel ikke fundet. <Link href="/articles" className="text-blue-400">← Tilbage</Link></div>

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/articles" className="text-blue-400 hover:text-blue-300 text-sm mb-6 block">← Alle artikler</Link>
      <Card>
        <CardContent className="py-8">
          <p className="text-blue-400 text-sm mb-2">{article.categoryName}</p>
          <h1 className="text-3xl font-bold text-white mb-3">{article.title}</h1>
          {article.summary && <p className="text-gray-400 text-lg mb-4">{article.summary}</p>}
          <p className="text-gray-500 text-sm mb-8">Af {article.authorCallsign || 'Ukendt'} &bull; {article.publishDate ? formatDate(article.publishDate) : ''}</p>
          <div className="prose prose-invert max-w-none text-gray-300 whitespace-pre-line leading-7">
            {article.content}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
