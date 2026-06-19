'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import type { Article } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { useLanguage } from '@/i18n/LanguageContext'

export function HomeArticlesSection() {
  const { t } = useLanguage()
  const [articles, setArticles] = useState<Article[]>([])

  useEffect(() => {
    api.articles.getPublished().then(items => setArticles(items.slice(0, 5))).catch(() => {})
  }, [])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t('home.latestArticles')}</CardTitle>
        <Link href="/articles" className="text-sm text-blue-400 hover:text-blue-300">{t('dashboard.viewAll')} &rarr;</Link>
      </CardHeader>
      <CardContent className="p-0">
        {articles.length === 0 ? (
          <p className="px-6 py-4 text-gray-500 text-sm">{t('home.noArticles')}</p>
        ) : (
          <div className="divide-y divide-gray-700">
            {articles.map(article => (
              <Link key={article.id} href={`/articles/${article.slug}`} className="block px-6 py-3 hover:bg-gray-700/30 transition-colors">
                <h4 className="font-medium text-white text-sm">{article.title}</h4>
                {article.summary && <p className="text-gray-500 text-xs mt-0.5 line-clamp-1">{article.summary}</p>}
                <p className="text-gray-600 text-xs mt-1">{article.categoryName} &bull; {formatDate(article.createdAt)}</p>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
