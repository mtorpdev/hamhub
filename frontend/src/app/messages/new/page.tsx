'use client'
import { Suspense, useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { type Friendship } from '@/lib/types'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useToast } from '@/contexts/ToastContext'

function NewMessageForm() {
  useRequireAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [form, setForm] = useState({
    recipientId: searchParams.get('to') || '',
    subject: decodeURIComponent(searchParams.get('subject') || ''),
    body: '',
  })
  const [friends, setFriends] = useState<Friendship[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.friends.getAll()
      .then(data => {
        setFriends(data)
        if (!searchParams.get('to') && data.length > 0) {
          setForm(f => ({ ...f, recipientId: data[0].otherUserId }))
        }
      })
      .catch(() => setFriends([]))
  }, [searchParams])

  const recipientLabel = useMemo(() => {
    const friend = friends.find(f => f.otherUserId === form.recipientId)
    return friend?.otherCallsign || friend?.otherEmail || ''
  }, [friends, form.recipientId])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSending(true)
    try {
      await api.messages.send(form)
      toast('Besked sendt!')
      router.push('/messages')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fejl')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-white mb-8">Ny besked</h1>
      <Card>
        <CardContent className="py-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-300">Til *</label>
              <select
                value={form.recipientId}
                onChange={e => setForm(f => ({ ...f, recipientId: e.target.value }))}
                required
                className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white text-sm"
              >
                <option value="" disabled>Vælg en ven</option>
                {friends.map(friend => (
                  <option key={friend.id} value={friend.otherUserId}>
                    {friend.otherCallsign || friend.otherEmail || friend.otherName || 'Ukendt'}
                  </option>
                ))}
              </select>
              {recipientLabel && <p className="text-xs text-green-400">{recipientLabel}</p>}
              {friends.length === 0 && <p className="text-xs text-gray-500">Du skal være venner med en bruger, før du kan sende private beskeder.</p>}
            </div>
            <Input label="Emne *" value={form.subject} onChange={set('subject')} required />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-300">Besked *</label>
              <textarea rows={6} value={form.body} onChange={set('body')} required placeholder="Skriv din besked..." className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white text-sm" />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-3">
              <Button type="submit" disabled={sending || friends.length === 0}>{sending ? 'Sender...' : 'Send besked'}</Button>
              <Button type="button" variant="secondary" onClick={() => router.push('/messages')}>Annuller</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function NewMessagePage() {
  return (
    <Suspense fallback={null}>
      <NewMessageForm />
    </Suspense>
  )
}
