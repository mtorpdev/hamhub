'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { pageShellClass } from '@/lib/layout'
import { type Post, type PostComment } from '@/lib/types'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useLanguage } from '@/i18n/LanguageContext'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { forumStatusClass } from '../forumUi'

export default function ForumThreadPage() {
  const params = useParams()
  const router = useRouter()
  const id = Number(params.id)
  const { user, isAuthenticated, isAdmin } = useAuth()
  const { toast } = useToast()
  const { t, language } = useLanguage()
  const [thread, setThread] = useState<Post | null>(null)
  const [comments, setComments] = useState<PostComment[]>([])
  const [reply, setReply] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!Number.isFinite(id)) return
    let cancelled = false
    Promise.all([api.posts.getById(id), api.posts.getComments(id)])
      .then(([post, postComments]) => {
        if (cancelled) return
        setThread(post)
        setComments(postComments)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [id])

  const formatDate = (value: string) => new Date(value).toLocaleString(language === 'da' ? 'da-DK' : 'en-US')

  const addReply = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!reply.trim()) return
    const created = await api.posts.addComment(id, reply)
    setComments(current => [...current, created])
    setReply('')
  }

  const toggleSolved = async () => {
    if (!thread) return
    const updated = await api.posts.setSolved(thread.id, !thread.isSolved)
    setThread(updated)
  }

  const togglePinned = async () => {
    if (!thread) return
    const updated = await api.posts.setPinned(thread.id, !thread.isPinned)
    setThread(updated)
  }

  const toggleLocked = async () => {
    if (!thread) return
    const updated = await api.posts.setLocked(thread.id, !thread.isLocked)
    setThread(updated)
  }

  const reportThread = async () => {
    if (!thread) return
    const reason = window.prompt(t('forum.reportPrompt'))
    if (!reason?.trim()) return
    await api.safety.report({ targetType: 'post', targetUserId: thread.userId, targetId: thread.id, reason: reason.trim() })
    toast(t('forum.reportSent'))
  }

  const deleteThread = async () => {
    if (!thread || !window.confirm(t('forum.deleteConfirm'))) return
    await api.posts.delete(thread.id)
    router.push('/forum')
  }

  if (loading) return <div className={pageShellClass}><p className="text-sm text-gray-400">{t('forum.loadingThread')}</p></div>
  if (!thread) return <div className={pageShellClass}><p className="text-sm text-gray-400">{t('forum.threadNotFound')}</p></div>

  const canManage = isAuthenticated && (user?.id === thread.userId || isAdmin)

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <div className={`${pageShellClass} space-y-5 py-6`}>
        <Link href="/forum" className="text-sm text-cyan-300 hover:text-cyan-200">{t('forum.back')}</Link>

        <Card className="border-gray-800 bg-gray-900">
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  {thread.isPinned && <span className="border border-blue-500/40 bg-blue-500/10 px-2 py-1 text-xs font-semibold text-blue-200">{t('forum.pinned')}</span>}
                  {thread.isLocked && <span className="border border-gray-600 bg-gray-800 px-2 py-1 text-xs font-semibold text-gray-200">{t('forum.locked')}</span>}
                  <span className={`border px-2 py-1 text-xs font-semibold ${forumStatusClass(thread.isSolved)}`}>{thread.isSolved ? t('forum.solved') : t('forum.open')}</span>
                  {thread.communityRoomName && <span className="text-xs text-gray-500">{thread.communityRoomName}</span>}
                </div>
                <h1 className="mt-3 text-2xl font-semibold text-white">{thread.title || t('forum.defaultThreadTitle')}</h1>
                <p className="mt-1 text-xs text-gray-500">{thread.authorCallsign ?? t('forum.unknownAuthor')} - {formatDate(thread.createdAt)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {canManage && <Button variant="secondary" onClick={toggleSolved}>{thread.isSolved ? t('forum.reopen') : t('forum.markSolved')}</Button>}
                {isAdmin && <Button variant="secondary" onClick={togglePinned}>{thread.isPinned ? t('forum.unpin') : t('forum.pin')}</Button>}
                {isAdmin && <Button variant="secondary" onClick={toggleLocked}>{thread.isLocked ? t('forum.unlock') : t('forum.lock')}</Button>}
                {isAuthenticated && user?.id !== thread.userId && <Button variant="secondary" onClick={reportThread}>{t('forum.report')}</Button>}
                {canManage && <Button variant="secondary" onClick={deleteThread}>{t('common.delete')}</Button>}
              </div>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-6 text-gray-200">{thread.content}</p>
            <div className="flex flex-wrap gap-2">
              {thread.tags.map(tag => <span key={tag} className="border border-gray-700 px-2 py-1 text-xs text-gray-300">#{tag}</span>)}
            </div>
          </CardContent>
        </Card>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase text-gray-400">{t('forum.repliesCount', { count: comments.length })}</h2>
          {comments.map(comment => (
            <div key={comment.id} className="border border-gray-800 bg-gray-900 px-4 py-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="font-mono text-sm text-cyan-200">{comment.authorCallsign ?? t('forum.unknownAuthor')}</span>
                <span className="text-xs text-gray-500">{formatDate(comment.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-gray-200">{comment.content}</p>
            </div>
          ))}
          {comments.length === 0 && <p className="border border-gray-800 bg-gray-900 px-4 py-6 text-sm text-gray-500">{t('forum.noReplies')}</p>}
        </section>

        {thread.isLocked ? (
          <p className="border border-gray-800 bg-gray-900 px-4 py-4 text-sm text-gray-400">{t('forum.lockedReplyNotice')}</p>
        ) : isAuthenticated ? (
          <form onSubmit={addReply} className="space-y-3 border border-gray-800 bg-gray-900 p-4">
            <textarea value={reply} onChange={event => setReply(event.target.value)} rows={4} placeholder={t('forum.replyPlaceholder')} className="w-full border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-700" />
            <Button type="submit">{t('forum.sendReply')}</Button>
          </form>
        ) : (
          <p className="border border-gray-800 bg-gray-900 px-4 py-4 text-sm text-gray-400">{t('forum.loginToReply')}</p>
        )}
      </div>
    </main>
  )
}
