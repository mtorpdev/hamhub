'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import type { Article } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { pageShellClass } from '@/lib/layout'
import { useLanguage } from '@/i18n/LanguageContext'

export default function ArticlesPage() {
  const { t } = useLanguage()
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.articles.getPublished().then(setArticles).finally(() => setLoading(false))
  }, [])

  return (
    <div className={pageShellClass}>
      <h1 className="text-3xl font-bold text-white mb-2">{t('articles.title')}</h1>
      <p className="text-gray-400 mb-8">{t('articles.description')}</p>
      {loading ? <p className="text-gray-400">{t('common.loading')}</p> : (
        <div className="flex flex-col gap-4">
          {articles.map(article => (
            <Link key={article.id} href={`/articles/${article.slug}`}>
              <Card className="hover:border-blue-600 transition-colors">
                <CardContent className="py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-white">{article.title}</h2>
                      {article.summary && <p className="text-gray-400 text-sm mt-1">{article.summary}</p>}
                      <p className="text-gray-500 text-xs mt-2">
                        {article.categoryName} &bull; {article.sourceName || article.authorCallsign || 'HamHub'} &bull; {formatDate(article.publishDate || article.createdAt)}
                      </p>
                    </div>
                    {article.isExternal && (
                      <span className="shrink-0 rounded border border-blue-500/30 px-2 py-1 text-xs text-blue-300">{t('articles.external')}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {articles.length === 0 && <p className="text-gray-400">{t('home.noArticles')}.</p>}
        </div>
      )}
    </div>
  )
}
