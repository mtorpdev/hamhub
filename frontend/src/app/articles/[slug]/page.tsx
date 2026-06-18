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

  useEffect(() => {
    if (!slug) return
    api.articles.getBySlug(slug)
      .then(a => {
        setArticle(a)
        return api.comments.getForArticle(a.id)
      })
      .then(setComments)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [slug])

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!article || !commentText.trim()) return
    setSubmitting(true)
    try {
      const c = await api.comments.create(article.id, commentText.trim())
      setComments(prev => [...prev, c])
      setCommentText('')
      toast('Kommentar tilføjet!')
    } catch {
      toast('Kunne ikke sende kommentar', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteComment = async (commentId: number) => {
    if (!article) return
    try {
      await api.comments.delete(article.id, commentId)
      setComments(prev => prev.filter(c => c.id !== commentId))
      toast('Kommentar slettet')
    } catch {
      toast('Sletning mislykkedes', 'error')
    }
  }

  if (loading) return <div className={`${pageShellClass} text-gray-400`}>Indlæser...</div>
  if (!article) return <div className={`${pageShellClass} text-gray-400`}>Artikel ikke fundet. <Link href="/articles" className="text-blue-400">← Tilbage</Link></div>

  return (
    <div className={pageShellClass}>
      <Link href="/articles" className="text-blue-400 hover:text-blue-300 text-sm mb-6 block">← Alle artikler</Link>
      <Card>
        <CardContent className="py-8">
          <p className="text-blue-400 text-sm mb-2">{article.categoryName}</p>
          <h1 className="text-3xl font-bold text-white mb-3">{article.title}</h1>
          {article.summary && <p className="text-gray-400 text-lg mb-4">{article.summary}</p>}
          <p className="text-gray-500 text-sm mb-8">
            {article.sourceName ? `Kilde: ${article.sourceName}` : `Af ${article.authorCallsign || 'Ukendt'}`}
            {article.publishDate ? ` • ${formatDate(article.publishDate)}` : ''}
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
                Læs hele nyheden hos {article.sourceName || 'kilden'}
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comments */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold text-white mb-4">Kommentarer ({comments.length})</h2>

        {comments.length === 0 && (
          <p className="text-gray-500 mb-6">Ingen kommentarer endnu. Vær den første!</p>
        )}

        <div className="flex flex-col gap-4 mb-6">
          {comments.map(c => (
            <div key={c.id} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-blue-400 font-mono text-sm font-medium">{c.authorCallsign || 'Ukendt'}</span>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 text-xs">{formatDate(c.createdAt)}</span>
                  {(user?.id === c.authorId || isAdmin) && (
                    <button onClick={() => handleDeleteComment(c.id)} className="text-red-500 hover:text-red-400 text-xs">Slet</button>
                  )}
                </div>
              </div>
              <p className="text-gray-300 text-sm whitespace-pre-line">{c.content}</p>
            </div>
          ))}
        </div>

        {isAuthenticated ? (
          <form onSubmit={handleComment} className="flex flex-col gap-3">
            <textarea
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              rows={3}
              placeholder="Skriv en kommentar..."
              className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white text-sm resize-none"
              maxLength={1000}
            />
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-xs">{commentText.length}/1000</span>
              <Button type="submit" disabled={submitting || !commentText.trim()}>
                {submitting ? 'Sender...' : 'Send kommentar'}
              </Button>
            </div>
          </form>
        ) : (
          <p className="text-gray-500 text-sm">
            <Link href="/login" className="text-blue-400">Log ind</Link> for at skrive en kommentar.
          </p>
        )}
      </div>
    </div>
  )
}
