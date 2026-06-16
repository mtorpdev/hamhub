'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { type CommunityContact, type CommunityRoom, type Message, type Post, type PostComment } from '@/lib/types'
import { useAuth } from '@/contexts/AuthContext'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useToast } from '@/contexts/ToastContext'
import { formatUtcDate } from '@/lib/utils'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.hamhub.dk'

const fallbackRooms: CommunityRoom[] = [
  { id: 0, name: 'Alle opslag', slug: 'alle', description: 'Hele community-feedet.', sortOrder: 0, isSystem: true },
  { id: 1, name: 'DX', slug: 'dx', description: 'DX spots, jagt og sjældne lande.', sortOrder: 10, isSystem: true },
  { id: 2, name: 'FT8/FT4', slug: 'ft8-ft4', description: 'Digitale modes og WSJT-X.', sortOrder: 20, isSystem: true },
  { id: 3, name: 'Teknik', slug: 'teknik', description: 'Radioer, antenner og software.', sortOrder: 30, isSystem: true },
  { id: 4, name: 'Køb/salg', slug: 'koeb-salg', description: 'Udstyr og gode fund.', sortOrder: 40, isSystem: true },
]

function PostCard({ post, currentUserId, onDelete }: { post: Post; currentUserId?: string; onDelete: () => void }) {
  const { toast } = useToast()
  const [liked, setLiked] = useState(post.isLikedByMe)
  const [likeCount, setLikeCount] = useState(post.likeCount)
  const [comments, setComments] = useState<PostComment[]>([])
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [loadingComments, setLoadingComments] = useState(false)
  const [commentCount, setCommentCount] = useState(post.commentCount)

  const handleLike = async () => {
    if (!currentUserId) return
    try {
      const res = await api.posts.toggleLike(post.id)
      setLiked(res.liked)
      setLikeCount(c => res.liked ? c + 1 : c - 1)
    } catch { /* ignore */ }
  }

  const toggleComments = async () => {
    if (!showComments && comments.length === 0) {
      setLoadingComments(true)
      try {
        const c = await api.posts.getComments(post.id)
        setComments(c)
      } finally { setLoadingComments(false) }
    }
    setShowComments(v => !v)
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentText.trim()) return
    try {
      const c = await api.posts.addComment(post.id, commentText)
      setComments(cs => [...cs, c])
      setCommentCount(n => n + 1)
      setCommentText('')
    } catch { toast('Fejl ved kommentar', 'error') }
  }

  const handleDeleteComment = async (commentId: number) => {
    try {
      await api.posts.deleteComment(post.id, commentId)
      setComments(cs => cs.filter(c => c.id !== commentId))
      setCommentCount(n => n - 1)
    } catch { toast('Fejl', 'error') }
  }

  return (
    <Card>
      <CardContent className="py-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-white font-semibold font-mono">{post.authorCallsign || 'Ukendt'}</span>
              {post.authorName && <span className="text-gray-500 text-sm">{post.authorName}</span>}
              {post.communityRoomName && (
                <span className="rounded border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-xs text-blue-200">
                  {post.communityRoomName}
                </span>
              )}
            </div>
            <span className="text-gray-600 text-xs">{formatUtcDate(post.createdAt)}</span>
          </div>
          {currentUserId === post.userId && (
            <button onClick={onDelete} className="text-gray-600 hover:text-red-400 text-xs">Slet</button>
          )}
        </div>

        <p className="text-gray-200 whitespace-pre-wrap mb-3">{post.content}</p>

        {post.images.length > 0 && (
          <div className={`grid gap-2 mb-3 ${post.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {post.images.map((url, i) => (
              <img key={i} src={`${API_URL}${url}`} alt="" className="rounded-lg w-full object-cover max-h-80" />
            ))}
          </div>
        )}

        <div className="flex items-center gap-4 pt-2 border-t border-gray-800">
          <button
            onClick={handleLike}
            className={`text-sm transition-colors ${liked ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'} ${!currentUserId ? 'cursor-default' : ''}`}
          >
            Synes om ({likeCount})
          </button>
          <button onClick={toggleComments} className="text-sm text-gray-500 hover:text-gray-300">
            Kommentarer ({commentCount})
          </button>
        </div>

        {showComments && (
          <div className="mt-3 border-t border-gray-800 pt-3">
            {loadingComments ? (
              <p className="text-gray-500 text-sm">Indlæser...</p>
            ) : (
              <div className="flex flex-col gap-2 mb-3">
                {comments.map(c => (
                  <div key={c.id} className="flex items-start gap-2">
                    <div className="flex-1">
                      <span className="text-blue-400 text-xs font-mono font-medium">{c.authorCallsign}</span>
                      <span className="text-gray-300 text-sm ml-2">{c.content}</span>
                    </div>
                    {(currentUserId === c.userId || currentUserId === post.userId) && (
                      <button onClick={() => handleDeleteComment(c.id)} className="text-gray-700 hover:text-red-400 text-xs">Slet</button>
                    )}
                  </div>
                ))}
                {comments.length === 0 && <p className="text-gray-600 text-sm">Ingen kommentarer endnu</p>}
              </div>
            )}
            {currentUserId && (
              <form onSubmit={handleAddComment} className="flex gap-2">
                <input
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="Skriv en kommentar..."
                  className="flex-1 rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-white text-sm"
                />
                <Button type="submit" size="sm">Send</Button>
              </form>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function CommunityPage() {
  const { isLoading } = useRequireAuth()
  const { isAuthenticated, user } = useAuth()
  const { toast } = useToast()
  const [rooms, setRooms] = useState<CommunityRoom[]>(fallbackRooms)
  const [selectedRoom, setSelectedRoom] = useState('alle')
  const [posts, setPosts] = useState<Post[]>([])
  const [contacts, setContacts] = useState<CommunityContact[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [chatText, setChatText] = useState('')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [newContent, setNewContent] = useState('')
  const [newImages, setNewImages] = useState<File[]>([])
  const [posting, setPosting] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const selectedRoomInfo = useMemo(
    () => rooms.find(r => r.slug === selectedRoom) ?? rooms[0],
    [rooms, selectedRoom]
  )
  const selectedContact = contacts.find(c => c.id === selectedContactId) ?? contacts[0]

  const loadFeed = async (p = 1, roomSlug = selectedRoom) => {
    setLoading(true)
    try {
      const res = await api.posts.getFeed(p, roomSlug)
      if (p === 1) setPosts(res.items)
      else setPosts(prev => [...prev, ...res.items])
      setTotal(res.total)
      setPage(p)
    } finally { setLoading(false) }
  }

  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false

    async function loadCommunity() {
      setLoading(true)
      try {
        const [roomData, feedData, contactData, inboxData] = await Promise.all([
          api.community.getRooms().catch(() => fallbackRooms),
          api.posts.getFeed(1, selectedRoom),
          api.community.getContacts().catch(() => []),
          api.messages.getInbox().catch(() => []),
        ])
        if (cancelled) return
        setRooms(roomData.length > 0 ? roomData : fallbackRooms)
        setPosts(feedData.items)
        setTotal(feedData.total)
        setPage(1)
        setContacts(contactData)
        setMessages(inboxData)
        setSelectedContactId(contactData[0]?.id ?? null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadCommunity()
    return () => { cancelled = true }
  }, [isAuthenticated, selectedRoom])

  const handleSelectRoom = (slug: string) => {
    setSelectedRoom(slug)
    setPosts([])
  }

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newContent.trim()) return
    setPosting(true)
    try {
      const post = await api.posts.create(newContent, selectedRoom)
      for (const file of newImages) {
        try { await api.posts.uploadImage(post.id, file) } catch { /* continue */ }
      }
      setNewContent('')
      setNewImages([])
      if (fileRef.current) fileRef.current.value = ''
      await loadFeed(1)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Fejl', 'error')
    } finally { setPosting(false) }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedContact || !chatText.trim()) return
    setSendingMessage(true)
    try {
      await api.messages.send({
        recipientId: selectedContact.id,
        subject: 'HamHub chat',
        body: chatText.trim(),
      })
      setChatText('')
      setMessages(await api.messages.getInbox().catch(() => messages))
      toast('Besked sendt')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Kunne ikke sende besked', 'error')
    } finally {
      setSendingMessage(false)
    }
  }

  const handleDelete = async (postId: number) => {
    if (!confirm('Slet opslag?')) return
    try {
      await api.posts.delete(postId)
      setPosts(ps => ps.filter(p => p.id !== postId))
      setTotal(t => t - 1)
    } catch { toast('Fejl', 'error') }
  }

  if (isLoading || !isAuthenticated) return null

  return (
    <div className="mx-auto max-w-[1520px] px-4 py-6">
      <div className="grid grid-cols-1 xl:grid-cols-[260px_minmax(0,720px)_320px] gap-5 items-start">
        <aside className="hidden xl:flex flex-col gap-4 sticky top-20">
          <div>
            <h1 className="text-2xl font-bold text-white">Community</h1>
            <p className="text-sm text-gray-500 mt-1">Rum, forum og radio-snak samlet ét sted.</p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Mine sider og fora</div>
            <div className="flex flex-col gap-1">
              {rooms.map(room => (
                <button
                  key={room.slug}
                  type="button"
                  onClick={() => handleSelectRoom(room.slug)}
                  className={`text-left rounded-md px-3 py-2 text-sm transition-colors ${
                    selectedRoom === room.slug
                      ? 'bg-blue-500/15 text-white border border-blue-500/30'
                      : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <span className="block font-medium">{room.name}</span>
                  {room.description && <span className="block text-xs text-gray-500 truncate">{room.description}</span>}
                </button>
              ))}
            </div>
            <Button type="button" variant="secondary" className="mt-3 w-full" disabled>
              Ny side
            </Button>
          </div>
        </aside>

        <main className="min-w-0">
          <div className="xl:hidden mb-4">
            <h1 className="text-3xl font-bold text-white mb-3">Community</h1>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {rooms.map(room => (
                <button
                  key={room.slug}
                  type="button"
                  onClick={() => handleSelectRoom(room.slug)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${
                    selectedRoom === room.slug
                      ? 'border-blue-500 bg-blue-500/15 text-white'
                      : 'border-gray-700 text-gray-300'
                  }`}
                >
                  {room.name}
                </button>
              ))}
            </div>
          </div>

          <Card className="mb-5">
            <CardContent className="py-5">
              <div className="mb-3">
                <div className="text-sm font-semibold text-white">{selectedRoomInfo?.name ?? 'Alle opslag'}</div>
                <div className="text-xs text-gray-500">{selectedRoomInfo?.description ?? 'Del noget med HamHub community.'}</div>
              </div>
              <form onSubmit={handlePost} className="flex flex-col gap-3">
                <textarea
                  rows={3}
                  value={newContent}
                  onChange={e => setNewContent(e.target.value)}
                  placeholder="Del noget med community..."
                  className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white text-sm resize-none"
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="cursor-pointer text-gray-400 hover:text-gray-200 text-sm">
                    Tilføj billeder
                    <input
                      ref={fileRef}
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={e => setNewImages(Array.from(e.target.files || []).slice(0, 4))}
                    />
                  </label>
                  {newImages.length > 0 && <span className="text-xs text-gray-500">{newImages.length} billede(r)</span>}
                  <Button type="submit" disabled={posting || !newContent.trim()} size="sm">
                    {posting ? 'Poster...' : 'Post'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {loading && posts.length === 0 ? (
            <p className="text-gray-400">Indlæser...</p>
          ) : posts.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-gray-400">Ingen opslag i dette rum endnu.</CardContent></Card>
          ) : (
            <div className="flex flex-col gap-4">
              {posts.map(p => (
                <PostCard
                  key={p.id}
                  post={p}
                  currentUserId={user?.id}
                  onDelete={() => handleDelete(p.id)}
                />
              ))}
              {posts.length < total && (
                <Button variant="secondary" onClick={() => loadFeed(page + 1)} disabled={loading}>
                  {loading ? 'Indlæser...' : 'Indlæs flere'}
                </Button>
              )}
            </div>
          )}
        </main>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-20">
          <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white">Kontakter</h2>
              <span className="text-xs text-gray-500">{contacts.length}</span>
            </div>
            <div className="flex flex-col gap-1 max-h-80 overflow-y-auto">
              {contacts.map(contact => (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => setSelectedContactId(contact.id)}
                  className={`flex items-center gap-3 rounded-md px-2 py-2 text-left transition-colors ${
                    selectedContact?.id === contact.id ? 'bg-blue-500/15' : 'hover:bg-gray-800'
                  }`}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-800 text-xs font-semibold text-blue-200">
                    {(contact.callsign || contact.email || '?').slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-gray-200">{contact.callsign || contact.email}</span>
                    <span className="block truncate text-xs text-gray-500">{contact.gridLocator || contact.country || contact.name || 'HamHub medlem'}</span>
                  </span>
                </button>
              ))}
              {contacts.length === 0 && <p className="text-sm text-gray-500">Ingen kontakter fundet.</p>}
            </div>
          </div>

          <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
            <h2 className="text-sm font-semibold text-white mb-3">Chat</h2>
            {selectedContact ? (
              <form onSubmit={handleSendMessage} className="flex flex-col gap-3">
                <div className="rounded-md bg-gray-800/70 px-3 py-2">
                  <div className="text-sm font-medium text-white">{selectedContact.callsign || selectedContact.email}</div>
                  <div className="text-xs text-gray-500">{selectedContact.name || selectedContact.gridLocator || 'Send en hurtig besked'}</div>
                </div>
                <textarea
                  rows={3}
                  value={chatText}
                  onChange={e => setChatText(e.target.value)}
                  placeholder="Skriv en besked..."
                  className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white text-sm resize-none"
                />
                <Button type="submit" size="sm" disabled={sendingMessage || !chatText.trim()}>
                  {sendingMessage ? 'Sender...' : 'Send besked'}
                </Button>
              </form>
            ) : (
              <p className="text-sm text-gray-500">Vælg en kontakt for at sende en besked.</p>
            )}
          </div>

          <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
            <h2 className="text-sm font-semibold text-white mb-3">Seneste beskeder</h2>
            <div className="flex flex-col gap-3">
              {messages.slice(0, 5).map(message => (
                <div key={message.id} className="border-b border-gray-800 pb-2 last:border-b-0 last:pb-0">
                  <div className="text-xs text-gray-500">{formatUtcDate(message.createdAt)}</div>
                  <div className="text-sm text-gray-200 font-medium">{message.senderCallsign || message.recipientCallsign}</div>
                  <div className="text-xs text-gray-500 line-clamp-2">{message.body}</div>
                </div>
              ))}
              {messages.length === 0 && <p className="text-sm text-gray-500">Ingen beskeder endnu.</p>}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
