'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { FriendshipStatus, type CommunityContact, type CommunityGroupInvitation, type CommunityGroupJoinRequest, type CommunityOnlineUser, type CommunityRoom, type FriendRequests, type Message, type Post, type PostComment } from '@/lib/types'
import { useAuth } from '@/contexts/AuthContext'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useToast } from '@/contexts/ToastContext'
import { useLanguage } from '@/i18n/LanguageContext'
import { formatUtcDate } from '@/lib/utils'
import { UserProfileCard, type ProfileCardUser } from '@/components/community/UserProfileCard'
import { filterCommunityGroups, groupOverviewCounts, membershipStatus, type GroupOverviewView } from './groupUi'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.hamhub.dk'

function fallbackRooms(t: ReturnType<typeof useLanguage>['t']): CommunityRoom[] {
  return [
    { id: 0, name: t('community.rooms.all'), slug: 'alle', description: t('community.rooms.allDescription'), sortOrder: 0, isSystem: true, visibility: 1, allowJoinRequests: true, memberCount: 0, membershipStatus: 3 },
    { id: 1, name: 'DX', slug: 'dx', description: t('community.rooms.dxDescription'), sortOrder: 10, isSystem: true },
    { id: 2, name: 'FT8/FT4', slug: 'ft8-ft4', description: t('community.rooms.digitalDescription'), sortOrder: 20, isSystem: true },
    { id: 3, name: t('community.rooms.tech'), slug: 'teknik', description: t('community.rooms.techDescription'), sortOrder: 30, isSystem: true },
    { id: 4, name: t('community.rooms.market'), slug: 'koeb-salg', description: t('community.rooms.marketDescription'), sortOrder: 40, isSystem: true },
    { id: 5, name: 'POTA / SOTA / Awards', slug: 'pota-sota-awards', description: t('community.rooms.potaDescription'), sortOrder: 25, isSystem: true },
  ]
}

function presentCommunityRoom(room: CommunityRoom, t: ReturnType<typeof useLanguage>['t']): CommunityRoom {
  if (!room.isSystem) return room
  if (room.slug === 'alle') return { ...room, name: t('community.rooms.all'), description: t('community.rooms.allDescription') }
  if (room.slug === 'dx') return { ...room, name: 'DX', description: t('community.rooms.dxDescription') }
  if (room.slug === 'ft8-ft4') return { ...room, name: 'FT8/FT4', description: t('community.rooms.digitalDescription') }
  if (room.slug === 'teknik') return { ...room, name: t('community.rooms.tech'), description: t('community.rooms.techDescription') }
  if (room.slug === 'koeb-salg') return { ...room, name: t('community.rooms.market'), description: t('community.rooms.marketDescription') }
  if (room.slug === 'pota-sota-awards') return { ...room, name: 'POTA / SOTA / Awards', description: t('community.rooms.potaDescription') }
  return room
}

function presentCommunityRooms(rooms: CommunityRoom[], fallbackRoomList: CommunityRoom[], t: ReturnType<typeof useLanguage>['t']) {
  const source = rooms.length > 0 ? rooms : fallbackRoomList
  return source.map(room => presentCommunityRoom(room, t)).sort((a, b) => a.sortOrder - b.sortOrder)
}

function PostCard({ post, currentUserId, onDelete }: { post: Post; currentUserId?: string; onDelete: () => void }) {
  const { toast } = useToast()
  const { t } = useLanguage()
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
    } catch { toast(t('community.post.commentFailed'), 'error') }
  }

  const handleDeleteComment = async (commentId: number) => {
    try {
      await api.posts.deleteComment(post.id, commentId)
      setComments(cs => cs.filter(c => c.id !== commentId))
      setCommentCount(n => n - 1)
    } catch { toast(t('messages.error'), 'error') }
  }

  const handleReportPost = async () => {
    const reason = window.prompt(t('community.reportPlaceholder'))
    if (!reason?.trim()) return
    try {
      await api.safety.report({ targetType: 'post', targetUserId: post.userId, targetId: post.id, reason: reason.trim() })
      toast(t('messages.reportSent'))
    } catch (err) {
      toast(err instanceof Error ? err.message : t('messages.reportFailed'), 'error')
    }
  }

  return (
    <Card>
      <CardContent className="py-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-white font-semibold font-mono">{post.authorCallsign || t('community.group.unknownAuthor')}</span>
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
            <button onClick={onDelete} className="text-gray-600 hover:text-red-400 text-xs">{t('community.post.delete')}</button>
          )}
          {currentUserId && currentUserId !== post.userId && (
            <button onClick={handleReportPost} className="text-gray-600 hover:text-yellow-300 text-xs">{t('community.report')}</button>
          )}
        </div>

        <p className="text-gray-200 whitespace-pre-wrap mb-3">{post.content}</p>

        {post.images.length > 0 && (
          <div className={`grid gap-2 mb-3 ${post.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {post.images.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={`${API_URL}${url}`} alt="" className="rounded-lg w-full object-cover max-h-80" />
            ))}
          </div>
        )}

        <div className="flex items-center gap-4 pt-2 border-t border-gray-800">
          <button
            onClick={handleLike}
            className={`text-sm transition-colors ${liked ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'} ${!currentUserId ? 'cursor-default' : ''}`}
          >
            {t('community.post.like', { count: likeCount })}
          </button>
          <button onClick={toggleComments} className="text-sm text-gray-500 hover:text-gray-300">
            {t('community.post.comments', { count: commentCount })}
          </button>
        </div>

        {showComments && (
          <div className="mt-3 border-t border-gray-800 pt-3">
            {loadingComments ? (
              <p className="text-gray-500 text-sm">{t('community.post.loadingComments')}</p>
            ) : (
              <div className="flex flex-col gap-2 mb-3">
                {comments.map(c => (
                  <div key={c.id} className="flex items-start gap-2">
                    <div className="flex-1">
                      <span className="text-blue-400 text-xs font-mono font-medium">{c.authorCallsign}</span>
                      <span className="text-gray-300 text-sm ml-2">{c.content}</span>
                    </div>
                    {(currentUserId === c.userId || currentUserId === post.userId) && (
                      <button onClick={() => handleDeleteComment(c.id)} className="text-gray-700 hover:text-red-400 text-xs">{t('community.post.delete')}</button>
                    )}
                  </div>
                ))}
                {comments.length === 0 && <p className="text-gray-600 text-sm">{t('community.post.noComments')}</p>}
              </div>
            )}
            {currentUserId && (
              <form onSubmit={handleAddComment} className="flex gap-2">
                <input
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder={t('community.post.commentPlaceholder')}
                  className="flex-1 rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-white text-sm"
                />
                <Button type="submit" size="sm">{t('messages.sendReply')}</Button>
              </form>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function contactLabel(contact: CommunityContact, fallback: string) {
  return contact.callsign || contact.email || fallback
}

function translatedVisibilityOptions(t: ReturnType<typeof useLanguage>['t']) {
  return [
    { value: 1, label: t('community.visibility.public'), description: t('community.group.access.public.description') },
    { value: 2, label: t('community.visibility.request'), description: t('community.group.access.notMember.description') },
    { value: 3, label: t('community.visibility.inviteOnly'), description: t('community.group.access.inviteOnly.description') },
  ]
}

function communityVisibilityLabel(value: CommunityRoom['visibility'], t: ReturnType<typeof useLanguage>['t']) {
  if (value === 'InviteOnly' || value === 3) return t('community.visibility.inviteOnly')
  if (value === 'RequestToJoin' || value === 2) return t('community.visibility.request')
  return t('community.visibility.public')
}

function CommunityMessengerPanel({
  contacts,
  onlineUsers,
  inboxMessages,
  selectedContactId,
  currentUserId,
  onSelectContact,
  onOpenProfile,
  onInboxRefresh,
}: {
  contacts: CommunityContact[]
  onlineUsers: CommunityOnlineUser[]
  inboxMessages: Message[]
  selectedContactId: string | null
  currentUserId?: string
  onSelectContact: (id: string) => void
  onOpenProfile: (user: ProfileCardUser) => void
  onInboxRefresh: () => Promise<void>
}) {
  const { toast } = useToast()
  const { t, language } = useLanguage()
  const [conversation, setConversation] = useState<Message[]>([])
  const [messageText, setMessageText] = useState('')
  const [loadingConversation, setLoadingConversation] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const selectedContact = useMemo(
    () => contacts.find(contact => contact.id === selectedContactId) ?? contacts[0] ?? null,
    [contacts, selectedContactId]
  )

  const onlineIds = useMemo(() => new Set(onlineUsers.map(onlineUser => onlineUser.id)), [onlineUsers])

  const unreadByContact = useMemo(() => {
    const map = new Map<string, number>()
    for (const message of inboxMessages) {
      if (!message.isRead) map.set(message.senderId, (map.get(message.senderId) ?? 0) + 1)
    }
    return map
  }, [inboxMessages])

  const latestByContact = useMemo(() => {
    const map = new Map<string, Message>()
    for (const message of inboxMessages) {
      const existing = map.get(message.senderId)
      if (!existing || new Date(message.createdAt) > new Date(existing.createdAt)) {
        map.set(message.senderId, message)
      }
    }
    return map
  }, [inboxMessages])

  const loadConversation = useCallback(async (contactId: string | null) => {
    if (!contactId) {
      setConversation([])
      return
    }
    setLoadingConversation(true)
    try {
      setConversation(await api.messages.getConversation(contactId))
      await onInboxRefresh()
    } catch {
      setConversation([])
    } finally {
      setLoadingConversation(false)
    }
  }, [onInboxRefresh])

  useEffect(() => {
    let cancelled = false
    const contactId = selectedContact?.id ?? null

    async function run() {
      await Promise.resolve()
      if (!cancelled) void loadConversation(contactId)
    }

    void run()
    return () => { cancelled = true }
  }, [loadConversation, selectedContact?.id])

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    if (!token || !currentUserId) return

    const connection = new HubConnectionBuilder()
      .withUrl(`${API_URL}/hubs/private-messages`, { accessTokenFactory: () => token })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build()

    connection.on('PrivateMessageCreated', (message: Message) => {
      const otherUserId = message.senderId === currentUserId ? message.recipientId : message.senderId
      if (otherUserId === selectedContact?.id) {
        setConversation(prev => prev.some(item => item.id === message.id) ? prev : [...prev, message])
      }
      void onInboxRefresh()
    })
    connection.on('NotificationSummaryChanged', () => {
      void onInboxRefresh()
    })

    connection.start().catch(() => undefined)
    return () => { void connection.stop().catch(() => undefined) }
  }, [currentUserId, onInboxRefresh, selectedContact?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [conversation.length, selectedContact?.id])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedContact || !messageText.trim()) return
    setSendingMessage(true)
    try {
      const message = await api.messages.send({
        recipientId: selectedContact.id,
        subject: t('messages.privateSubject'),
        body: messageText.trim(),
      })
      setConversation(prev => prev.some(item => item.id === message.id) ? prev : [...prev, message])
      setMessageText('')
      await onInboxRefresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : t('messages.sendFailed'), 'error')
    } finally {
      setSendingMessage(false)
    }
  }

  const handleReportContact = async () => {
    if (!selectedContact) return
    const reason = window.prompt(t('community.reportPlaceholder'))
    if (!reason?.trim()) return
    try {
      await api.safety.report({ targetType: 'user', targetUserId: selectedContact.id, reason: reason.trim() })
      toast(t('messages.reportSent'))
    } catch (err) {
      toast(err instanceof Error ? err.message : t('messages.reportFailed'), 'error')
    }
  }

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/50">
      <div className="border-b border-gray-800 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">{t('community.messaging.title')}</h2>
            <p className="text-xs text-gray-500">{t('community.messaging.description')}</p>
          </div>
          <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-xs text-blue-200">
            {t('community.messaging.unread', { count: inboxMessages.filter(message => !message.isRead).length })}
          </span>
        </div>
      </div>

      <div className="grid min-h-[620px] grid-cols-1 md:grid-cols-[150px_minmax(0,1fr)] xl:grid-cols-1 2xl:grid-cols-[150px_minmax(0,1fr)]">
        <div className="border-b border-gray-800 md:border-b-0 md:border-r xl:border-b xl:border-r-0 2xl:border-b-0 2xl:border-r">
          <div className="max-h-64 overflow-y-auto p-2 md:max-h-[620px] xl:max-h-56 2xl:max-h-[620px]">
            {contacts.map(contact => {
              const label = contactLabel(contact, t('common.unknownUser'))
              const latest = latestByContact.get(contact.id)
              const unread = unreadByContact.get(contact.id) ?? 0
              const isOnline = onlineIds.has(contact.id)

              return (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => onSelectContact(contact.id)}
                  className={`mb-1 flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors ${
                    selectedContact?.id === contact.id ? 'bg-blue-500/15 text-white' : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-800 text-xs font-semibold text-blue-200">
                    {label.slice(0, 2).toUpperCase()}
                    {isOnline && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-gray-900 bg-green-400" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1">
                      <span className="truncate text-sm font-medium">{label}</span>
                      {unread > 0 && <span className="rounded-full bg-blue-600 px-1.5 text-[10px] font-semibold text-white">{unread}</span>}
                    </span>
                    <span className="block truncate text-xs text-gray-500">{latest?.body ?? contact.gridLocator ?? contact.name ?? t('community.messaging.privateConversation')}</span>
                  </span>
                </button>
              )
            })}
            {contacts.length === 0 && (
              <p className="px-2 py-6 text-sm text-gray-500">{t('community.messaging.needFriend')}</p>
            )}
          </div>
        </div>

        <div className="flex min-h-[420px] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-gray-800 p-3">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-white">{selectedContact ? contactLabel(selectedContact, t('common.unknownUser')) : t('community.messaging.selectFriend')}</h3>
              <p className="truncate text-xs text-gray-500">{selectedContact?.gridLocator || selectedContact?.country || selectedContact?.name || t('community.messaging.privateMessage')}</p>
            </div>
            {selectedContact && (
              <div className="flex shrink-0 gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={() => onOpenProfile({ ...selectedContact, isFriend: true, friendshipStatus: FriendshipStatus.Accepted })}>
                  {t('community.profile')}
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={handleReportContact}>
                  {t('community.report')}
                </Button>
              </div>
            )}
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto bg-gray-950/40 p-3">
            {loadingConversation ? (
              <p className="text-sm text-gray-500">{t('community.messaging.loadingConversation')}</p>
            ) : !selectedContact ? (
              <p className="text-sm text-gray-500">{t('community.messaging.selectContact')}</p>
            ) : conversation.length === 0 ? (
              <p className="text-sm text-gray-500">{t('community.messaging.noMessages')}</p>
            ) : conversation.map(message => {
              const mine = message.senderId === currentUserId
              return (
                <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[82%] rounded-md px-3 py-2 ${mine ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-100'}`}>
                    <div className={`mb-1 text-[11px] ${mine ? 'text-blue-100' : 'text-gray-500'}`}>
                      {new Date(message.createdAt).toLocaleTimeString(language === 'da' ? 'da-DK' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="whitespace-pre-wrap break-words text-sm">{message.body}</div>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={handleSendMessage} className="border-t border-gray-800 p-3">
            <textarea
              rows={2}
              maxLength={1000}
              value={messageText}
              onChange={e => setMessageText(e.target.value)}
              placeholder={selectedContact ? t('community.messaging.writeTo', { name: contactLabel(selectedContact, t('common.unknownUser')) }) : t('community.messaging.chooseContact')}
              disabled={!selectedContact}
              className="w-full resize-none rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white disabled:opacity-50"
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-xs text-gray-600">{messageText.length}/1000</span>
              <Button type="submit" size="sm" disabled={sendingMessage || !selectedContact || !messageText.trim()}>
                {sendingMessage ? t('community.messaging.sending') : t('messages.sendPrivate')}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function CommunityPage() {
  const { isLoading } = useRequireAuth()
  const { isAuthenticated, user } = useAuth()
  const { toast } = useToast()
  const { t, language } = useLanguage()
  const fallbackRoomList = useMemo(() => fallbackRooms(t), [t])
  const [rooms, setRooms] = useState<CommunityRoom[]>(fallbackRoomList)
  const [selectedRoom, setSelectedRoom] = useState('alle')
  const [posts, setPosts] = useState<Post[]>([])
  const [contacts, setContacts] = useState<CommunityContact[]>([])
  const [groupInvitations, setGroupInvitations] = useState<CommunityGroupInvitation[]>([])
  const [joinRequests, setJoinRequests] = useState<CommunityGroupJoinRequest[]>([])
  const [onlineUsers, setOnlineUsers] = useState<CommunityOnlineUser[]>([])
  const [friendRequests, setFriendRequests] = useState<FriendRequests>({ incoming: [], outgoing: [] })
  const [messages, setMessages] = useState<Message[]>([])
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [profileUser, setProfileUser] = useState<ProfileCardUser | null>(null)
  const [requestingUserId, setRequestingUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [newContent, setNewContent] = useState('')
  const [newImages, setNewImages] = useState<File[]>([])
  const [posting, setPosting] = useState(false)
  const [groupComposerOpen, setGroupComposerOpen] = useState(false)
  const [groupDraft, setGroupDraft] = useState({ name: '', description: '', visibility: 1, allowJoinRequests: true })
  const [groupActionLoading, setGroupActionLoading] = useState(false)
  const [groupView, setGroupView] = useState<GroupOverviewView>('official')
  const [groupSearch, setGroupSearch] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const selectedRoomInfo = useMemo(
    () => rooms.find(r => r.slug === selectedRoom) ?? rooms[0],
    [rooms, selectedRoom]
  )
  const selectedMembership = membershipStatus(selectedRoomInfo?.membershipStatus)
  const canPostInSelectedGroup = selectedRoom === 'alle' || selectedRoomInfo?.isSystem || selectedMembership === 'Owner' || selectedMembership === 'Admin' || selectedMembership === 'Member' || selectedRoomInfo?.visibility === 1 || selectedRoomInfo?.visibility === 'Public'
  const canManageSelectedGroup = selectedMembership === 'Owner' || selectedMembership === 'Admin'
  const overviewCounts = useMemo(() => groupOverviewCounts(rooms, groupInvitations), [rooms, groupInvitations])
  const filteredGroups = useMemo(() => filterCommunityGroups(rooms, groupView, groupSearch), [rooms, groupSearch, groupView])

  const loadOnlineUsers = useCallback(async () => {
    try {
      setOnlineUsers(await api.community.getOnlineUsers())
    } catch {
      setOnlineUsers([])
    }
  }, [])

  const loadInboxMessages = useCallback(async () => {
    try {
      setMessages(await api.messages.getInbox())
    } catch {
      setMessages([])
    }
  }, [])

  const loadGroups = useCallback(async () => {
    try {
      const groups = await api.community.getGroups()
      setRooms(presentCommunityRooms(groups, fallbackRoomList, t))
    } catch {
      setRooms(fallbackRoomList)
    }
  }, [fallbackRoomList, t])

  const loadGroupInvitations = useCallback(async () => {
    try {
      setGroupInvitations(await api.community.getGroupInvitations())
    } catch {
      setGroupInvitations([])
    }
  }, [])

  const loadJoinRequests = useCallback(async (group: CommunityRoom | undefined) => {
    if (!group || group.slug === 'alle' || !(membershipStatus(group.membershipStatus) === 'Owner' || membershipStatus(group.membershipStatus) === 'Admin')) {
      setJoinRequests([])
      return
    }
    try {
      setJoinRequests(await api.community.getGroupJoinRequests(group.id))
    } catch {
      setJoinRequests([])
    }
  }, [])

  const loadFeed = async (p = 1, roomSlug = selectedRoom) => {
    setLoading(true)
    try {
      const res = await api.posts.getFeed(p, roomSlug, undefined, undefined, undefined, 'community')
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
        const [roomData, feedData, contactData, onlineData, requestData, inboxData, invitationData] = await Promise.all([
          api.community.getGroups().catch(() => fallbackRoomList),
          api.posts.getFeed(1, selectedRoom, undefined, undefined, undefined, 'community'),
          api.community.getContacts().catch(() => []),
          api.community.getOnlineUsers().catch(() => []),
          api.friends.getRequests().catch(() => ({ incoming: [], outgoing: [] })),
          api.messages.getInbox().catch(() => []),
          api.community.getGroupInvitations().catch(() => []),
        ])
        if (cancelled) return
        setRooms(presentCommunityRooms(roomData, fallbackRoomList, t))
        setPosts(feedData.items)
        setTotal(feedData.total)
        setPage(1)
        setContacts(contactData)
        setOnlineUsers(onlineData)
        setFriendRequests(requestData)
        setMessages(inboxData)
        setGroupInvitations(invitationData)
        setSelectedContactId(contactData[0]?.id ?? null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadCommunity()
    return () => { cancelled = true }
  }, [fallbackRoomList, isAuthenticated, selectedRoom, t])

  useEffect(() => {
    if (!isAuthenticated) return
    const timer = window.setInterval(loadOnlineUsers, 15_000)
    return () => window.clearInterval(timer)
  }, [isAuthenticated, loadOnlineUsers])

  const handleSelectRoom = (room: CommunityRoom) => {
    setSelectedRoom(room.slug)
    setPosts([])
    void loadJoinRequests(room)
  }

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!groupDraft.name.trim()) return
    setGroupActionLoading(true)
    try {
      const group = await api.community.createGroup({
        name: groupDraft.name.trim(),
        description: groupDraft.description.trim() || null,
        visibility: groupDraft.visibility,
        allowJoinRequests: groupDraft.visibility !== 3 && groupDraft.allowJoinRequests,
      })
      await loadGroups()
      setSelectedRoom(group.slug)
      setGroupDraft({ name: '', description: '', visibility: 1, allowJoinRequests: true })
      setGroupComposerOpen(false)
      toast(t('community.groups.created'))
    } catch (err) {
      toast(err instanceof Error ? err.message : t('community.groups.createFailed'), 'error')
    } finally {
      setGroupActionLoading(false)
    }
  }

  const handleRequestToJoin = async () => {
    if (!selectedRoomInfo || selectedRoomInfo.slug === 'alle') return
    setGroupActionLoading(true)
    try {
      await api.community.requestToJoinGroup(selectedRoomInfo.id)
      await loadGroups()
      toast(t('community.group.requestSent'))
    } catch (err) {
      toast(err instanceof Error ? err.message : t('community.group.requestFailed'), 'error')
    } finally {
      setGroupActionLoading(false)
    }
  }

  const handleApproveJoinRequest = async (requestId: number) => {
    if (!selectedRoomInfo) return
    setGroupActionLoading(true)
    try {
      await api.community.approveGroupJoinRequest(selectedRoomInfo.id, requestId)
      await Promise.all([loadGroups(), loadJoinRequests(selectedRoomInfo)])
      toast(t('community.group.approved'))
    } catch (err) {
      toast(err instanceof Error ? err.message : t('community.group.approveFailed'), 'error')
    } finally {
      setGroupActionLoading(false)
    }
  }

  const handleRejectJoinRequest = async (requestId: number) => {
    if (!selectedRoomInfo) return
    setGroupActionLoading(true)
    try {
      await api.community.rejectGroupJoinRequest(selectedRoomInfo.id, requestId)
      await loadJoinRequests(selectedRoomInfo)
      toast(t('community.group.rejected'))
    } catch (err) {
      toast(err instanceof Error ? err.message : t('community.group.rejectFailed'), 'error')
    } finally {
      setGroupActionLoading(false)
    }
  }

  const handleInviteContact = async (contactId: string) => {
    if (!selectedRoomInfo) return
    setGroupActionLoading(true)
    try {
      await api.community.inviteToGroup(selectedRoomInfo.id, contactId)
      toast(t('community.group.invitationSent'))
    } catch (err) {
      toast(err instanceof Error ? err.message : t('community.group.invitationFailed'), 'error')
    } finally {
      setGroupActionLoading(false)
    }
  }

  const handleAcceptInvitation = async (invitationId: number) => {
    setGroupActionLoading(true)
    try {
      await api.community.acceptGroupInvitation(invitationId)
      await Promise.all([loadGroups(), loadGroupInvitations()])
      toast(t('community.groups.invitationAccepted'))
    } catch (err) {
      toast(err instanceof Error ? err.message : t('community.groups.invitationAcceptFailed'), 'error')
    } finally {
      setGroupActionLoading(false)
    }
  }

  const handleDeclineInvitation = async (invitationId: number) => {
    setGroupActionLoading(true)
    try {
      await api.community.declineGroupInvitation(invitationId)
      await loadGroupInvitations()
      toast(t('community.groups.invitationDeclined'))
    } catch (err) {
      toast(err instanceof Error ? err.message : t('community.groups.invitationDeclineFailed'), 'error')
    } finally {
      setGroupActionLoading(false)
    }
  }

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newContent.trim() || !canPostInSelectedGroup) return
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
      toast(err instanceof Error ? err.message : t('messages.error'), 'error')
    } finally { setPosting(false) }
  }

  const handleDelete = async (postId: number) => {
    if (!confirm(t('community.post.deleteConfirm'))) return
    try {
      await api.posts.delete(postId)
      setPosts(ps => ps.filter(p => p.id !== postId))
      setTotal(t => t - 1)
    } catch { toast(t('community.post.deleteFailed'), 'error') }
  }

  const handleOnlineUserClick = async (onlineUser: CommunityOnlineUser) => {
    if (onlineUser.isFriend) {
      setSelectedContactId(onlineUser.id)
      setProfileUser(onlineUser)
      return
    }
    if (onlineUser.friendshipStatus === FriendshipStatus.Pending && onlineUser.friendshipDirection === 'incoming') {
      const request = friendRequests.incoming.find(item => item.otherUserId === onlineUser.id)
      if (request) {
        setRequestingUserId(onlineUser.id)
        try {
          await api.friends.accept(request.id)
          toast(t('community.groups.friendRequestAccepted'))
          await Promise.all([loadOnlineUsers(), api.community.getContacts().then(setContacts), api.friends.getRequests().then(setFriendRequests)])
        } catch (err) {
          toast(err instanceof Error ? err.message : t('community.groups.friendAcceptFailed'), 'error')
        } finally {
          setRequestingUserId(null)
        }
      }
      return
    }
    if (onlineUser.friendshipStatus === FriendshipStatus.Pending) {
      setProfileUser(onlineUser)
      return
    }

    setRequestingUserId(onlineUser.id)
    try {
      await api.friends.sendRequest(onlineUser.id)
      setOnlineUsers(users => users.map(item =>
        item.id === onlineUser.id
          ? { ...item, friendshipStatus: FriendshipStatus.Pending, friendshipDirection: 'outgoing' }
          : item
      ))
      toast(t('community.groups.friendRequestSentTo', { name: onlineUser.callsign || onlineUser.name || onlineUser.email || t('common.unknownUser') }))
      setFriendRequests(await api.friends.getRequests())
    } catch (err) {
      toast(err instanceof Error ? err.message : t('community.groups.friendRequestFailed'), 'error')
    } finally {
      setRequestingUserId(null)
    }
  }

  if (isLoading || !isAuthenticated) return null

  return (
    <div className="mx-auto max-w-[1520px] px-4 py-6">
      {profileUser && (
        <UserProfileCard
          user={profileUser}
          incomingRequestId={friendRequests.incoming.find(item => item.otherUserId === profileUser.id)?.id}
          onClose={() => setProfileUser(null)}
          onChanged={() => {
            void Promise.all([
              loadOnlineUsers(),
              api.community.getContacts().then(setContacts),
              api.friends.getRequests().then(setFriendRequests),
            ])
          }}
        />
      )}
      {groupComposerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <form onSubmit={handleCreateGroup} className="w-full max-w-xl rounded-lg border border-gray-800 bg-gray-950 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">{t('community.groups.create')}</h2>
              <button type="button" onClick={() => setGroupComposerOpen(false)} className="text-sm text-gray-400 hover:text-white">{t('common.close')}</button>
            </div>
            <div className="space-y-3">
              <input
                value={groupDraft.name}
                onChange={event => setGroupDraft(current => ({ ...current, name: event.target.value }))}
                placeholder={t('community.groups.namePlaceholder')}
                className="h-10 w-full rounded border border-gray-700 bg-gray-900 px-3 text-sm text-white outline-none focus:border-blue-600"
              />
              <textarea
                value={groupDraft.description}
                onChange={event => setGroupDraft(current => ({ ...current, description: event.target.value }))}
                rows={3}
                placeholder={t('community.groups.descriptionPlaceholder')}
                className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-600"
              />
              <div className="grid gap-2">
                {translatedVisibilityOptions(t).map(option => (
                  <label key={option.value} className={`cursor-pointer rounded border p-3 ${groupDraft.visibility === option.value ? 'border-blue-600 bg-blue-950/30' : 'border-gray-800 bg-gray-900'}`}>
                    <span className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="groupVisibility"
                        checked={groupDraft.visibility === option.value}
                        onChange={() => setGroupDraft(current => ({ ...current, visibility: option.value, allowJoinRequests: option.value !== 3 && current.allowJoinRequests }))}
                        className="mt-1"
                      />
                      <span>
                        <span className="block text-sm font-semibold text-white">{option.label}</span>
                        <span className="block text-xs text-gray-500">{option.description}</span>
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              {groupDraft.visibility !== 3 && (
                <label className="flex items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={groupDraft.allowJoinRequests}
                    onChange={event => setGroupDraft(current => ({ ...current, allowJoinRequests: event.target.checked }))}
                  />
                  {t('community.groups.allowRequests')}
                </label>
              )}
              <Button type="submit" disabled={groupActionLoading || !groupDraft.name.trim()}>
                {groupActionLoading ? t('community.groups.creating') : t('community.groups.create')}
              </Button>
            </div>
          </form>
        </div>
      )}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_430px] xl:items-start">
        <section className="min-w-0">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[240px_minmax(0,760px)]">
            <aside className="hidden lg:flex flex-col gap-4 sticky top-20">
              <div>
                <h1 className="text-2xl font-bold text-white">{t('community.groups.title')}</h1>
                <p className="text-sm text-gray-500 mt-1">{t('community.groups.description')}</p>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
                <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">{t('community.groups.overview')}</div>
                <div className="mb-2 grid grid-cols-2 gap-1">
                  {[
                    ['official', t('community.groups.official', { count: overviewCounts.official })],
                    ['mine', t('community.groups.mine', { count: overviewCounts.mine })],
                    ['owned', t('community.groups.owned', { count: overviewCounts.owned })],
                    ['discover', t('community.groups.discover', { count: overviewCounts.discover })],
                    ['invitations', t('community.groups.invites', { count: overviewCounts.invitations })],
                  ].map(([view, label]) => (
                    <button
                      key={view}
                      type="button"
                      onClick={() => setGroupView(view as GroupOverviewView)}
                      className={`rounded border px-2 py-1 text-xs ${groupView === view ? 'border-blue-600 bg-blue-950/40 text-blue-100' : 'border-gray-800 text-gray-400 hover:bg-gray-800'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <input
                  value={groupSearch}
                  onChange={event => setGroupSearch(event.target.value)}
                  placeholder={t('community.groups.search')}
                  className="mb-2 h-9 w-full rounded border border-gray-800 bg-gray-950 px-2 text-sm text-white outline-none focus:border-blue-600"
                />
                <div className="flex flex-col gap-1">
                  {filteredGroups.map(room => (
                    <button
                      key={room.slug}
                      type="button"
                      onClick={() => handleSelectRoom(room)}
                      className={`text-left rounded-md px-3 py-2 text-sm transition-colors ${
                        selectedRoom === room.slug
                          ? 'bg-blue-500/15 text-white border border-blue-500/30'
                          : 'text-gray-300 hover:bg-gray-800'
                      }`}
                    >
                      <span className="block font-medium">{room.name}</span>
                      <span className="block text-[11px] text-gray-600">{communityVisibilityLabel(room.visibility, t)} - {t('community.group.membersCount', { count: room.memberCount ?? 0 })}</span>
                      {room.description && <span className="block text-xs text-gray-500 truncate">{room.description}</span>}
                    </button>
                  ))}
                  {filteredGroups.length === 0 && <p className="px-2 py-4 text-sm text-gray-500">{t('community.groups.noMatches')}</p>}
                </div>
                <Button type="button" variant="secondary" className="mt-3 w-full" onClick={() => setGroupComposerOpen(true)}>
                  {t('community.groups.create')}
                </Button>
              </div>
            </aside>

            <main className="min-w-0">
              <div className="lg:hidden mb-4">
                <h1 className="text-3xl font-bold text-white mb-3">{t('community.groups.title')}</h1>
                <div className="mb-3 flex gap-2 overflow-x-auto">
                  {[
                    ['official', t('community.groups.official', { count: overviewCounts.official })],
                    ['mine', t('community.groups.mine', { count: overviewCounts.mine })],
                    ['owned', t('community.groups.owned', { count: overviewCounts.owned })],
                    ['discover', t('community.groups.discover', { count: overviewCounts.discover })],
                    ['invitations', t('community.groups.invites', { count: overviewCounts.invitations })],
                  ].map(([view, label]) => (
                    <button
                      key={view}
                      type="button"
                      onClick={() => setGroupView(view as GroupOverviewView)}
                      className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${groupView === view ? 'border-blue-500 bg-blue-500/15 text-white' : 'border-gray-700 text-gray-300'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <input
                  value={groupSearch}
                  onChange={event => setGroupSearch(event.target.value)}
                  placeholder={t('community.groups.search')}
                  className="mb-3 h-10 w-full rounded border border-gray-800 bg-gray-950 px-3 text-sm text-white outline-none focus:border-blue-600"
                />
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {filteredGroups.map(room => (
                    <button
                      key={room.slug}
                      type="button"
                      onClick={() => handleSelectRoom(room)}
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

              {groupView === 'invitations' && (
                <Card className="mb-5">
                  <CardContent className="py-5">
                    <h2 className="mb-3 text-sm font-semibold text-white">{t('community.groups.invitations')}</h2>
                    {groupInvitations.length === 0 ? (
                      <p className="text-sm text-gray-500">{t('community.groups.noOpenInvitations')}</p>
                    ) : (
                      <div className="space-y-2">
                        {groupInvitations.map(invitation => (
                          <div key={invitation.id} className="flex flex-col gap-2 rounded border border-gray-800 p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <div className="text-sm font-semibold text-white">{invitation.groupName}</div>
                              <div className="text-xs text-gray-500">{t('community.groups.invitedBy', { name: invitation.inviterCallsign || t('community.groups.adminFallback') })}</div>
                            </div>
                            <div className="flex gap-2">
                              <Button type="button" size="sm" onClick={() => handleAcceptInvitation(invitation.id)} disabled={groupActionLoading}>{t('messages.accept')}</Button>
                              <Button type="button" size="sm" variant="secondary" onClick={() => handleDeclineInvitation(invitation.id)} disabled={groupActionLoading}>{t('messages.decline')}</Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card className="mb-5">
                <CardContent className="py-5">
                  <div className="mb-3">
                    <div className="text-sm font-semibold text-white">{selectedRoomInfo?.name ?? t('community.groups.allPosts')}</div>
                    <div className="text-xs text-gray-500">{selectedRoomInfo?.description ?? t('community.groups.shareFallback')}</div>
                    {selectedRoomInfo && selectedRoomInfo.slug !== 'alle' && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <span className="rounded border border-gray-700 px-2 py-1">{communityVisibilityLabel(selectedRoomInfo.visibility, t)}</span>
                        <span className="rounded border border-gray-700 px-2 py-1">{t('community.group.membersCount', { count: selectedRoomInfo.memberCount ?? 0 })}</span>
                        <span className="rounded border border-gray-700 px-2 py-1">{selectedMembership === 'None' ? t('community.groups.notMember') : selectedMembership === 'Pending' ? t('community.access.requestSent') : t('community.role.member')}</span>
                        <Link href={`/community/groups/${selectedRoomInfo.slug}`} className="rounded border border-blue-700 px-2 py-1 text-blue-200 hover:bg-blue-950/30">{t('community.groups.openGroup')}</Link>
                      </div>
                    )}
                  </div>
                  {!canPostInSelectedGroup && selectedMembership !== 'Pending' && selectedRoomInfo?.allowJoinRequests && (
                    <div className="mb-3 rounded-md border border-yellow-700/40 bg-yellow-950/20 p-3 text-sm text-yellow-100">
                      {t('community.groups.memberOnlyNotice')}
                      <Button type="button" size="sm" className="ml-3" onClick={handleRequestToJoin} disabled={groupActionLoading}>
                        {t('community.group.requestAccess')}
                      </Button>
                    </div>
                  )}
                  {!canPostInSelectedGroup && selectedMembership === 'Pending' && (
                    <div className="mb-3 rounded-md border border-blue-700/40 bg-blue-950/20 p-3 text-sm text-blue-100">{t('community.groups.pendingNotice')}</div>
                  )}
                  <form onSubmit={handlePost} className="flex flex-col gap-3">
                    <textarea
                      rows={3}
                      value={newContent}
                      onChange={e => setNewContent(e.target.value)}
                      placeholder={t('community.group.postPlaceholder')}
                      disabled={!canPostInSelectedGroup}
                      className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white text-sm resize-none disabled:opacity-50"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="cursor-pointer text-gray-400 hover:text-gray-200 text-sm">
                        {t('community.groups.addImages')}
                        <input
                          ref={fileRef}
                          type="file"
                          multiple
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={e => setNewImages(Array.from(e.target.files || []).slice(0, 4))}
                        />
                      </label>
                      {newImages.length > 0 && <span className="text-xs text-gray-500">{t('community.groups.imagesCount', { count: newImages.length })}</span>}
                      <Button type="submit" disabled={posting || !newContent.trim() || !canPostInSelectedGroup} size="sm">
                        {posting ? t('community.groups.posting') : 'Post'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              {canManageSelectedGroup && selectedRoomInfo?.slug !== 'alle' && (
                <Card className="mb-5">
                  <CardContent className="space-y-4 py-5">
                    <div>
                      <h2 className="text-sm font-semibold text-white">{t('community.groups.admin')}</h2>
                      <p className="text-xs text-gray-500">{t('community.groups.adminDescription')}</p>
                    </div>
                    {joinRequests.length > 0 && (
                      <div className="space-y-2">
                        {joinRequests.map(request => (
                          <div key={request.id} className="flex items-center justify-between gap-3 rounded border border-gray-800 px-3 py-2">
                            <span className="text-sm text-gray-200">{request.callsign || request.email || t('common.unknownUser')}</span>
                            <Button type="button" size="sm" onClick={() => handleApproveJoinRequest(request.id)} disabled={groupActionLoading}>
                              {t('community.group.approve')}
                            </Button>
                            <Button type="button" size="sm" variant="secondary" onClick={() => handleRejectJoinRequest(request.id)} disabled={groupActionLoading}>
                              {t('messages.decline')}
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    {contacts.length > 0 && (
                      <div>
                        <div className="mb-2 text-xs uppercase tracking-wide text-gray-500">{t('community.group.inviteContact')}</div>
                        <div className="flex flex-wrap gap-2">
                          {contacts.slice(0, 12).map(contact => (
                            <Button key={contact.id} type="button" size="sm" variant="secondary" onClick={() => handleInviteContact(contact.id)} disabled={groupActionLoading}>
                              {contact.callsign || contact.email}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {loading && posts.length === 0 ? (
                <p className="text-gray-400">{t('common.loading')}</p>
              ) : posts.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-gray-400">{t('community.groups.noRoomPosts')}</CardContent></Card>
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
                      {loading ? t('common.loading') : t('community.groups.loadMore')}
                    </Button>
                  )}
                </div>
              )}
            </main>
          </div>
        </section>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-20">
          <CommunityMessengerPanel
            contacts={contacts}
            onlineUsers={onlineUsers}
            inboxMessages={messages}
            selectedContactId={selectedContactId}
            currentUserId={user?.id}
            onSelectContact={setSelectedContactId}
            onOpenProfile={setProfileUser}
            onInboxRefresh={loadInboxMessages}
          />

          {groupInvitations.length > 0 && (
            <div className="rounded-lg border border-blue-800/60 bg-blue-950/20 p-4">
              <h2 className="mb-3 text-sm font-semibold text-white">{t('community.groups.invitations')}</h2>
              <div className="space-y-2">
                {groupInvitations.map(invitation => (
                  <div key={invitation.id} className="rounded border border-blue-900/60 bg-gray-950/40 p-3">
                    <div className="text-sm font-semibold text-blue-100">{invitation.groupName}</div>
                    <div className="text-xs text-gray-500">{t('community.groups.invitedBy', { name: invitation.inviterCallsign || t('community.groups.adminFallback') })}</div>
                    <Button type="button" size="sm" className="mt-2" onClick={() => handleAcceptInvitation(invitation.id)} disabled={groupActionLoading}>
                      {t('messages.accept')}
                    </Button>
                    <Button type="button" size="sm" variant="secondary" className="ml-2 mt-2" onClick={() => handleDeclineInvitation(invitation.id)} disabled={groupActionLoading}>
                      {t('messages.decline')}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">{t('community.groups.onlineNow')}</h2>
              <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs text-green-300">{onlineUsers.length}</span>
            </div>
            <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
              {onlineUsers.map(onlineUser => {
                const label = onlineUser.callsign || onlineUser.name || onlineUser.email || t('common.unknownUser')
                const alreadyPending = onlineUser.friendshipStatus === FriendshipStatus.Pending
                const buttonText = onlineUser.isFriend
                  ? t('community.groups.open')
                  : alreadyPending
                    ? onlineUser.friendshipDirection === 'incoming' ? t('community.groups.reply') : t('community.groups.sent')
                    : requestingUserId === onlineUser.id ? t('community.messaging.sending') : t('community.groups.add')

                return (
                  <button
                    key={onlineUser.id}
                  type="button"
                  onClick={() => handleOnlineUserClick(onlineUser)}
                  disabled={requestingUserId === onlineUser.id || (alreadyPending && onlineUser.friendshipDirection !== 'incoming')}
                    className="flex items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-gray-800 disabled:cursor-default disabled:hover:bg-transparent"
                  >
                    <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-800 text-xs font-semibold text-green-200">
                      {label.slice(0, 2).toUpperCase()}
                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-gray-900 bg-green-400" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-gray-200">{label}</span>
                      <span className="block truncate text-xs text-gray-500">{onlineUser.gridLocator || onlineUser.country || onlineUser.name || t('community.groups.onlineMember')}</span>
                    </span>
                    <span className={`shrink-0 rounded px-2 py-1 text-xs ${
                      onlineUser.isFriend
                        ? 'bg-blue-500/15 text-blue-200'
                        : alreadyPending
                          ? 'bg-yellow-500/10 text-yellow-200'
                          : 'bg-gray-800 text-gray-200'
                    }`}>
                      {buttonText}
                    </span>
                  </button>
                )
              })}
              {onlineUsers.length === 0 && <p className="text-sm text-gray-500">{t('community.groups.noOnline')}</p>}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
