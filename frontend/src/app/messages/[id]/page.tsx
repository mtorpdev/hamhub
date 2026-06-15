'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { type Message } from '@/lib/types'
import { useAuth } from '@/contexts/AuthContext'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useToast } from '@/contexts/ToastContext'
import { formatUtcDate } from '@/lib/utils'

export default function MessagePage() {
  useRequireAuth()
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const { toast } = useToast()
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
      toast('Svar sendt!')
      setReplyBody('')
      router.push('/messages')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Fejl', 'error')
    } finally {
      setSending(false)
    }
  }

  if (loading) return <div className="max-w-6xl mx-auto px-4 py-10 text-gray-400">Indlæser...</div>
  if (!message) return null

  const otherParty = message.senderId === user?.id ? message.recipientCallsign : message.senderCallsign

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <Link href="/messages" className="text-blue-400 hover:text-blue-300 text-sm mb-6 inline-block">← Tilbage til beskeder</Link>

      <Card className="mb-4">
        <CardContent className="py-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-white">{message.subject}</h1>
              <p className="text-gray-400 text-sm mt-1">
                {message.senderId === user?.id ? `Til: ${message.recipientCallsign}` : `Fra: ${message.senderCallsign}`}
                {' · '}{formatUtcDate(message.createdAt)}
              </p>
            </div>
          </div>
          <p className="text-gray-300 whitespace-pre-wrap">{message.body}</p>
        </CardContent>
      </Card>

      {message.senderId !== user?.id && (
        <Card>
          <CardContent className="py-5">
            <h2 className="text-white font-medium mb-3">Svar til {otherParty}</h2>
            <form onSubmit={handleReply} className="flex flex-col gap-3">
              <textarea
                rows={4}
                value={replyBody}
                onChange={e => setReplyBody(e.target.value)}
                placeholder="Skriv dit svar..."
                required
                className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white text-sm"
              />
              <div className="flex gap-3">
                <Button type="submit" disabled={sending}>{sending ? 'Sender...' : 'Send svar'}</Button>
                <Button type="button" variant="secondary" onClick={() => router.push('/messages')}>Annuller</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
