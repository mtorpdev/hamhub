'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { type Message } from '@/lib/types'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useToast } from '@/contexts/ToastContext'
import { formatUtcDate } from '@/lib/utils'

export default function MessagesPage() {
  useRequireAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [tab, setTab] = useState<'inbox' | 'sent'>('inbox')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)

  const load = (t: 'inbox' | 'sent') => {
    setLoading(true)
    const fn = t === 'inbox' ? api.messages.getInbox : api.messages.getSent
    fn().then(setMessages).finally(() => setLoading(false))
  }

  useEffect(() => { load(tab) }, [tab])

  const handleDelete = async (id: number) => {
    try {
      await api.messages.delete(id)
      setMessages(ms => ms.filter(m => m.id !== id))
      toast('Besked slettet')
    } catch { toast('Fejl', 'error') }
  }

  const unread = messages.filter(m => !m.isRead && tab === 'inbox').length

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Beskeder</h1>
          {unread > 0 && <p className="text-blue-400 text-sm mt-1">{unread} ulæst(e)</p>}
        </div>
        <Link href="/messages/new"><Button>+ Ny besked</Button></Link>
      </div>

      <div className="flex gap-2 mb-4">
        {(['inbox', 'sent'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${tab === t ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
          >
            {t === 'inbox' ? 'Indbakke' : 'Sendt'}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400">Indlæser...</p>
      ) : messages.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-400">Ingen beskeder</CardContent></Card>
      ) : (
        <div className="flex flex-col gap-2">
          {messages.map(m => (
            <Card key={m.id} className={!m.isRead && tab === 'inbox' ? 'border-blue-500/50' : ''}>
              <CardContent className="py-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => router.push(`/messages/${m.id}`)}>
                    <div className="flex items-center gap-2 mb-0.5">
                      {!m.isRead && tab === 'inbox' && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
                      <span className={`font-medium ${!m.isRead && tab === 'inbox' ? 'text-white' : 'text-gray-300'}`}>
                        {tab === 'inbox' ? (m.senderCallsign || 'Ukendt') : (m.recipientCallsign || 'Ukendt')}
                      </span>
                      <span className="text-gray-500 text-xs">{formatUtcDate(m.createdAt)}</span>
                    </div>
                    <p className={`text-sm truncate ${!m.isRead && tab === 'inbox' ? 'text-white' : 'text-gray-400'}`}>{m.subject}</p>
                    <p className="text-xs text-gray-600 truncate">{m.body}</p>
                  </div>
                  <button onClick={() => handleDelete(m.id)} className="text-gray-600 hover:text-red-400 text-xs flex-shrink-0">Slet</button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
