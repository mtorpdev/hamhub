'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { type FriendCandidate, type FriendRequests, type Friendship, FriendshipStatus, type Message } from '@/lib/types'
import { useAuth } from '@/contexts/AuthContext'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useToast } from '@/contexts/ToastContext'
import { formatUtcDate } from '@/lib/utils'

type Tab = 'inbox' | 'sent' | 'friends' | 'requests'
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.hamhub.dk'

function friendLabel(friend: Friendship | FriendCandidate) {
  if ('otherCallsign' in friend) return friend.otherCallsign || friend.otherEmail || 'Ukendt'
  return friend.callsign || friend.email || 'Ukendt'
}

export default function MessagesPage() {
  useRequireAuth()
  const { user } = useAuth()
  const { toast } = useToast()
  const [tab, setTab] = useState<Tab>('inbox')
  const [messages, setMessages] = useState<Message[]>([])
  const [friends, setFriends] = useState<Friendship[]>([])
  const [requests, setRequests] = useState<FriendRequests>({ incoming: [], outgoing: [] })
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null)
  const [conversation, setConversation] = useState<Message[]>([])
  const [replyText, setReplyText] = useState('')
  const [search, setSearch] = useState('')
  const [candidates, setCandidates] = useState<FriendCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const selectedFriend = useMemo(
    () => friends.find(f => f.otherUserId === selectedFriendId) ?? friends[0] ?? null,
    [friends, selectedFriendId]
  )

  const loadMessages = async (nextTab = tab) => {
    setLoading(true)
    try {
      const data = nextTab === 'sent' ? await api.messages.getSent() : await api.messages.getInbox()
      setMessages(data)
    } finally {
      setLoading(false)
    }
  }

  const loadFriends = async () => {
    const [friendData, requestData] = await Promise.all([
      api.friends.getAll(),
      api.friends.getRequests(),
    ])
    setFriends(friendData)
    setRequests(requestData)
    if (!selectedFriendId && friendData.length > 0) setSelectedFriendId(friendData[0].otherUserId)
  }

  useEffect(() => {
    void Promise.resolve().then(async () => {
      await loadMessages(tab)
      await loadFriends().catch(() => undefined)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  useEffect(() => {
    let cancelled = false
    if (!selectedFriend) {
      void Promise.resolve().then(() => {
        if (!cancelled) setConversation([])
      })
      return
    }
    api.messages.getConversation(selectedFriend.otherUserId)
      .then(data => { if (!cancelled) setConversation(data) })
      .catch(() => { if (!cancelled) setConversation([]) })
    return () => { cancelled = true }
  }, [selectedFriend])

  useEffect(() => {
    const q = search.trim()
    if (q.length < 2) return
    const timer = window.setTimeout(() => {
      api.friends.search(q).then(setCandidates).catch(() => setCandidates([]))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    if (!token || !user?.id) return

    const connection = new HubConnectionBuilder()
      .withUrl(`${API_URL}/hubs/private-messages`, { accessTokenFactory: () => token })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build()

    connection.on('PrivateMessageCreated', (message: Message) => {
      const otherUserId = message.senderId === user.id ? message.recipientId : message.senderId
      if (selectedFriendId === otherUserId) {
        void api.messages.getConversation(otherUserId)
          .then(setConversation)
          .catch(() => setConversation(prev => prev.some(item => item.id === message.id) ? prev : [...prev, message]))
      }

      if (tab === 'inbox' && message.recipientId === user.id) {
        setMessages(prev => prev.some(item => item.id === message.id) ? prev : [message, ...prev])
      }
      if (tab === 'sent' && message.senderId === user.id) {
        setMessages(prev => prev.some(item => item.id === message.id) ? prev : [message, ...prev])
      }
    })

    connection.on('FriendshipChanged', () => {
      void loadFriends().catch(() => undefined)
    })
    connection.on('NotificationSummaryChanged', () => {
      if (tab === 'inbox') void loadMessages('inbox').catch(() => undefined)
    })

    connection.start().catch(() => undefined)
    return () => { void connection.stop().catch(() => undefined) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFriendId, tab, user?.id])

  const refreshAll = async () => {
    await Promise.all([loadMessages(tab), loadFriends()])
    if (selectedFriend) {
      setConversation(await api.messages.getConversation(selectedFriend.otherUserId).catch(() => []))
    }
  }

  const sendRequest = async (userId: string) => {
    setBusy(true)
    try {
      await api.friends.sendRequest(userId)
      toast('Venneanmodning sendt')
      setSearch('')
      setCandidates([])
      await loadFriends()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Kunne ikke sende anmodning', 'error')
    } finally {
      setBusy(false)
    }
  }

  const accept = async (id: number) => {
    await api.friends.accept(id)
    toast('Venneanmodning accepteret')
    await refreshAll()
  }

  const decline = async (id: number) => {
    await api.friends.decline(id)
    toast('Venneanmodning afvist')
    await loadFriends()
  }

  const remove = async (friend: Friendship) => {
    if (!confirm(`Fjern ${friendLabel(friend)} som ven?`)) return
    await api.friends.remove(friend.otherUserId)
    toast('Ven fjernet')
    setSelectedFriendId(null)
    await refreshAll()
  }

  const sendPrivateMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFriend || !replyText.trim()) return
    setBusy(true)
    try {
      const message = await api.messages.send({
        recipientId: selectedFriend.otherUserId,
        subject: 'Privat besked',
        body: replyText.trim(),
      })
      setConversation(prev => [...prev, message])
      setReplyText('')
      await loadMessages(tab)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Kunne ikke sende besked', 'error')
    } finally {
      setBusy(false)
    }
  }

  const unread = messages.filter(m => !m.isRead && tab === 'inbox').length

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white">Beskeder</h1>
          <p className="mt-1 text-sm text-gray-500">Private beskeder er kun mellem accepterede venner.</p>
          {unread > 0 && <p className="mt-1 text-sm text-blue-400">{unread} ulæst(e)</p>}
        </div>
        <Link href="/messages/new"><Button>Ny besked</Button></Link>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {([
          ['inbox', 'Indbakke'],
          ['sent', 'Sendt'],
          ['friends', `Venner (${friends.length})`],
          ['requests', `Anmodninger (${requests.incoming.length})`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded px-4 py-2 text-sm font-medium transition-colors ${tab === key ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {(tab === 'inbox' || tab === 'sent') && (
        loading ? (
          <p className="text-gray-400">Indlæser...</p>
        ) : messages.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-gray-400">Ingen beskeder</CardContent></Card>
        ) : (
          <div className="flex flex-col gap-2">
            {messages.map(m => (
              <Link key={m.id} href={`/messages/${m.id}`}>
                <Card className={!m.isRead && tab === 'inbox' ? 'border-blue-500/50' : ''}>
                  <CardContent className="py-3">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-0.5 flex items-center gap-2">
                          {!m.isRead && tab === 'inbox' && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />}
                          <span className={`font-medium ${!m.isRead && tab === 'inbox' ? 'text-white' : 'text-gray-300'}`}>
                            {tab === 'inbox' ? (m.senderCallsign || 'Ukendt') : (m.recipientCallsign || 'Ukendt')}
                          </span>
                          <span className="text-xs text-gray-500">{formatUtcDate(m.createdAt)}</span>
                        </div>
                        <p className={`truncate text-sm ${!m.isRead && tab === 'inbox' ? 'text-white' : 'text-gray-400'}`}>{m.subject}</p>
                        <p className="truncate text-xs text-gray-600">{m.body}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )
      )}

      {tab === 'friends' && (
        <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card>
            <CardContent className="py-4">
              <h2 className="mb-3 text-sm font-semibold text-white">Find venner</h2>
              <input
                value={search}
                onChange={e => {
                  setSearch(e.target.value)
                  if (e.target.value.trim().length < 2) setCandidates([])
                }}
                placeholder="Søg callsign, navn eller email..."
                className="mb-3 w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
              />
              <div className="flex flex-col gap-2">
                {candidates.map(candidate => (
                  <div key={candidate.userId} className="rounded-md border border-gray-800 bg-gray-950/50 p-3">
                    <div className="font-mono text-sm font-semibold text-white">{friendLabel(candidate)}</div>
                    <div className="text-xs text-gray-500">{candidate.name || candidate.gridLocator || candidate.email}</div>
                    <Button
                      className="mt-2"
                      size="sm"
                      disabled={busy || candidate.friendshipStatus === FriendshipStatus.Accepted || candidate.friendshipStatus === FriendshipStatus.Pending}
                      onClick={() => sendRequest(candidate.userId)}
                    >
                      {candidate.friendshipStatus === FriendshipStatus.Accepted
                        ? 'Allerede ven'
                        : candidate.friendshipStatus === FriendshipStatus.Pending
                          ? 'Anmodning findes'
                          : 'Tilføj ven'}
                    </Button>
                  </div>
                ))}
                {search.trim().length >= 2 && candidates.length === 0 && <p className="text-sm text-gray-500">Ingen resultater.</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <h2 className="mb-3 text-sm font-semibold text-white">Mine venner</h2>
              {friends.length === 0 ? (
                <p className="text-sm text-gray-500">Du har ingen venner endnu.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {friends.map(friend => (
                    <div key={friend.id} className="rounded-md border border-gray-800 bg-gray-950/50 p-3">
                      <div className="font-mono text-sm font-semibold text-white">{friendLabel(friend)}</div>
                      <div className="text-xs text-gray-500">{friend.otherName || friend.otherGridLocator || friend.otherEmail}</div>
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" onClick={() => { setSelectedFriendId(friend.otherUserId); setTab('requests') }}>Skriv</Button>
                        <Button size="sm" variant="secondary" onClick={() => remove(friend)}>Fjern</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'requests' && (
        <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="flex flex-col gap-5">
            <Card>
              <CardContent className="py-4">
                <h2 className="mb-3 text-sm font-semibold text-white">Indgående anmodninger</h2>
                <div className="flex flex-col gap-2">
                  {requests.incoming.map(request => (
                    <div key={request.id} className="rounded-md border border-gray-800 bg-gray-950/50 p-3">
                      <div className="font-mono text-sm font-semibold text-white">{friendLabel(request)}</div>
                      <div className="text-xs text-gray-500">{request.otherName || request.otherGridLocator || request.otherEmail}</div>
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" onClick={() => accept(request.id)}>Accepter</Button>
                        <Button size="sm" variant="secondary" onClick={() => decline(request.id)}>Afvis</Button>
                      </div>
                    </div>
                  ))}
                  {requests.incoming.length === 0 && <p className="text-sm text-gray-500">Ingen indgående anmodninger.</p>}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="py-4">
                <h2 className="mb-3 text-sm font-semibold text-white">Sendte anmodninger</h2>
                <div className="flex flex-col gap-2">
                  {requests.outgoing.map(request => (
                    <div key={request.id} className="rounded-md border border-gray-800 bg-gray-950/50 p-3">
                      <div className="font-mono text-sm font-semibold text-white">{friendLabel(request)}</div>
                      <div className="text-xs text-gray-500">Afventer svar</div>
                    </div>
                  ))}
                  {requests.outgoing.length === 0 && <p className="text-sm text-gray-500">Ingen sendte anmodninger.</p>}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="py-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-white">Messenger</h2>
                  <p className="text-xs text-gray-500">{selectedFriend ? friendLabel(selectedFriend) : 'Vælg en ven'}</p>
                </div>
              </div>
              {friends.length > 0 && (
                <select
                  value={selectedFriend?.otherUserId ?? ''}
                  onChange={e => setSelectedFriendId(e.target.value)}
                  className="mb-3 w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
                >
                  {friends.map(friend => <option key={friend.id} value={friend.otherUserId}>{friendLabel(friend)}</option>)}
                </select>
              )}
              <div className="mb-3 flex min-h-80 max-h-96 flex-col gap-2 overflow-y-auto rounded-md border border-gray-800 bg-gray-950/60 p-3">
                {conversation.length === 0 ? (
                  <p className="text-sm text-gray-500">Ingen private beskeder i samtalen endnu.</p>
                ) : conversation.map(message => {
                  const mine = message.senderId === user?.id
                  return (
                    <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-md px-3 py-2 ${mine ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-100'}`}>
                        <div className={`mb-1 text-[11px] ${mine ? 'text-blue-100' : 'text-gray-500'}`}>
                          {new Date(message.createdAt).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="whitespace-pre-wrap break-words text-sm">{message.body}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <form onSubmit={sendPrivateMessage} className="flex flex-col gap-2">
                <textarea
                  rows={3}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Skriv privat besked..."
                  disabled={!selectedFriend}
                  className="w-full resize-none rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
                />
                <Button type="submit" size="sm" disabled={busy || !selectedFriend || !replyText.trim()}>Send privat besked</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
