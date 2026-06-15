'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useToast } from '@/contexts/ToastContext'

export default function NewMessagePage() {
  useRequireAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [form, setForm] = useState({
    recipientId: searchParams.get('to') || '',
    subject: decodeURIComponent(searchParams.get('subject') || ''),
    body: '',
  })
  const [recipientLabel, setRecipientLabel] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (form.recipientId) {
      api.users.getById(form.recipientId)
        .then(u => setRecipientLabel(u.callsign || u.email || ''))
        .catch(() => {})
    }
  }, [form.recipientId])

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
    <div className="max-w-xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-white mb-8">Ny besked</h1>
      <Card>
        <CardContent className="py-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-300">Til (bruger-ID) *</label>
              <input
                value={form.recipientId}
                onChange={e => setForm(f => ({ ...f, recipientId: e.target.value }))}
                required
                placeholder="Bruger-ID"
                className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white text-sm"
              />
              {recipientLabel && <p className="text-xs text-green-400">{recipientLabel}</p>}
            </div>
            <Input label="Emne *" value={form.subject} onChange={set('subject')} required />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-300">Besked *</label>
              <textarea rows={6} value={form.body} onChange={set('body')} required placeholder="Skriv din besked..." className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white text-sm" />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-3">
              <Button type="submit" disabled={sending}>{sending ? 'Sender...' : 'Send besked'}</Button>
              <Button type="button" variant="secondary" onClick={() => router.push('/messages')}>Annuller</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
