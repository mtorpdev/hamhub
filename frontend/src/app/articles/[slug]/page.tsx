'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import type { Article, ArticleComment } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useLanguage } from '@/i18n/LanguageContext'
import { pageShellClass } from '@/lib/layout'

export default function ArticlePage() {
  const { slug } = useParams<{ slug: string }>()
  const [article, setArticle] = useState<Article | null>(null)
  const [comments, setComments] = useState<ArticleComment[]>([])
  const [loading, setLoading] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { isAuthenticated, user, isAdmin } = useAuth()
  const { toast } = useToast()
  const { t } = useLanguage()

  useEffect(() => {
    if (!slug) return
    api.articles.getBySlug(slug)
      .then((loadedArticle) => {
        setArticle(loadedArticle)
        return api.comments.getForArticle(loadedArticle.id)
      })
      .then(setComments)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [slug])

  const handleComment = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!article || !commentText.trim()) return
    setSubmitting(true)
    try {
      const comment = await api.comments.create(article.id, commentText.trim())
      setComments((prev) => [...prev, comment])
      setCommentText('')
      toast(t('articles.commentAdded'))
    } catch {
      toast(t('articles.commentFailed'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteComment = async (commentId: number) => {
    if (!article) return
    try {
      await api.comments.delete(article.id, commentId)
      setComments((prev) => prev.filter((comment) => comment.id !== commentId))
      toast(t('articles.commentDeleted'))
    } catch {
      toast(t('articles.commentDeleteFailed'), 'error')
    }
  }

  if (loading) return <div className={`${pageShellClass} text-gray-400`}>{t('common.loading')}</div>

  if (!article) return (
    <div className={`${pageShellClass} text-gray-400`}>
      {t('articles.notFound')}{' '}
      <Link href="/articles" className="text-blue-400">&lt; {t('common.back')}</Link>
    </div>
  )

  const byline = article.sourceName
    ? t('articles.sourceByline', { source: article.sourceName })
    : t('articles.authorByline', { author: article.authorCallsign || t('common.unknown') })

  return (
    <div className={pageShellClass}>
      <Link href="/articles" className="text-blue-400 hover:text-blue-300 text-sm mb-6 block">
        &lt; {t('articles.allArticles')}
      </Link>
      <Card>
        <CardContent className="py-8">
          <p className="text-blue-400 text-sm mb-2">{article.categoryName}</p>
          <h1 className="text-3xl font-bold text-white mb-3">{article.title}</h1>
          {article.summary && <p className="text-gray-400 text-lg mb-4">{article.summary}</p>}
          <p className="text-gray-500 text-sm mb-8">
            {byline}
            {article.publishDate ? ` - ${formatDate(article.publishDate)}` : ''}
          </p>
          <div className="prose prose-invert max-w-none text-gray-300 whitespace-pre-line leading-7">
            {article.content}
          </div>
          {article.originalUrl && (
            <div className="mt-8 border-t border-gray-800 pt-5">
              <a
                href={article.originalUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
              >
                {t('articles.readFullSource', { source: article.sourceName || t('articles.sourceFallback') })}
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-8">
        <h2 className="text-xl font-semibold text-white mb-4">
          {t('articles.commentsWithCount', { count: comments.length })}
        </h2>

        {comments.length === 0 && (
          <p className="text-gray-500 mb-6">{t('articles.noComments')}</p>
        )}

        <div className="flex flex-col gap-4 mb-6">
          {comments.map((comment) => (
            <div key={comment.id} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-blue-400 font-mono text-sm font-medium">{comment.authorCallsign || t('common.unknown')}</span>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 text-xs">{formatDate(comment.createdAt)}</span>
                  {(user?.id === comment.authorId || isAdmin) && (
                    <button onClick={() => handleDeleteComment(comment.id)} className="text-red-500 hover:text-red-400 text-xs">
                      {t('common.delete')}
                    </button>
                  )}
                </div>
              </div>
              <p className="text-gray-300 text-sm whitespace-pre-line">{comment.content}</p>
            </div>
          ))}
        </div>

        {isAuthenticated ? (
          <form onSubmit={handleComment} className="flex flex-col gap-3">
            <textarea
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              rows={3}
              placeholder={t('articles.commentPlaceholder')}
              className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white text-sm resize-none"
              maxLength={1000}
            />
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-xs">{commentText.length}/1000</span>
              <Button type="submit" disabled={submitting || !commentText.trim()}>
                {submitting ? t('articles.sendingComment') : t('articles.sendComment')}
              </Button>
            </div>
          </form>
        ) : (
          <p className="text-gray-500 text-sm">
            <Link href="/login" className="text-blue-400">{t('nav.login')}</Link> {t('articles.loginToComment')}
          </p>
        )}
      </div>
    </div>
  )
}
