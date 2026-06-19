'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { type Message } from '@/lib/types'
import { useAuth } from '@/contexts/AuthContext'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useToast } from '@/contexts/ToastContext'
import { useLanguage } from '@/i18n/LanguageContext'
import { formatUtcDate } from '@/lib/utils'
import { pageShellClass } from '@/lib/layout'

export default function MessagePage() {
  useRequireAuth()
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const { toast } = useToast()
  const { t } = useLanguage()
  const [message, setMessage] = useState<Message | null>(null)
  const [loading, setLoading] = useState(true)
  const [replyBody, setReplyBody] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    api.messages.getById(Number(id))
      .then(setMessage)
      .catch(() => router.replace('/messages'))
      .finally(() => setLoading(false))
  }, [id, router])

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message || !replyBody.trim()) return
    setSending(true)
    try {
      const recipientId = message.senderId === user?.id ? message.recipientId : message.senderId
      await api.messages.send({
        recipientId,
        subject: message.subject.startsWith('Re: ') ? message.subject : `Re: ${message.subject}`,
        body: replyBody,
      })
      toast(t('messages.replySent'))
      setReplyBody('')
      router.push('/messages')
    } catch (err) {
      toast(err instanceof Error ? err.message : t('messages.error'), 'error')
    } finally {
      setSending(false)
    }
  }

  if (loading) return <div className={`${pageShellClass} text-gray-400`}>{t('messages.loading')}</div>
  if (!message) return null

  const otherParty = message.senderId === user?.id ? message.recipientCallsign : message.senderCallsign

  return (
    <div className={pageShellClass}>
      <Link href="/messages" className="mb-6 inline-block text-sm text-blue-400 hover:text-blue-300">{`<- ${t('messages.back')}`}</Link>

      <Card className="mb-4">
        <CardContent className="py-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">{message.subject}</h1>
              <p className="mt-1 text-sm text-gray-400">
                {message.senderId === user?.id ? `${t('messages.to')}: ${message.recipientCallsign}` : `${t('messages.from')}: ${message.senderCallsign}`}
                {' - '}{formatUtcDate(message.createdAt)}
              </p>
            </div>
          </div>
          <p className="whitespace-pre-wrap text-gray-300">{message.body}</p>
        </CardContent>
      </Card>

      {message.senderId !== user?.id && (
        <Card>
          <CardContent className="py-5">
            <h2 className="mb-3 font-medium text-white">{t('messages.replyTo', { name: otherParty || t('messages.unknown') })}</h2>
            <form onSubmit={handleReply} className="flex flex-col gap-3">
              <textarea rows={4} value={replyBody} onChange={e => setReplyBody(e.target.value)} placeholder={t('messages.replyPlaceholder')} required className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white" />
              <div className="flex gap-3">
                <Button type="submit" disabled={sending}>{sending ? t('common.saving') : t('messages.sendReply')}</Button>
                <Button type="button" variant="secondary" onClick={() => router.push('/messages')}>{t('common.cancel')}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
