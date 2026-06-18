'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { pageShellClass } from '@/lib/layout'
import { type CommunityRoom, type Post } from '@/lib/types'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { forumStatusClass, forumStatusLabel, normalizeForumTags } from './forumUi'

const fallbackRooms: CommunityRoom[] = [
  { id: 0, name: 'Alle', slug: 'alle', description: 'Alle forumtråde.', sortOrder: 0, isSystem: true },
  { id: 1, name: 'POTA / SOTA / Awards', slug: 'forum-pota-sota-awards', description: 'Parker, toppe og diplomer.', sortOrder: 10, isSystem: true },
  { id: 2, name: 'Digital modes', slug: 'forum-digital-modes', description: 'WSJT-X, FT8, FT4 og data modes.', sortOrder: 20, isSystem: true },
  { id: 3, name: 'Teknik', slug: 'forum-teknik', description: 'Radioer, antenner og software.', sortOrder: 30, isSystem: true },
  { id: 4, name: 'DX', slug: 'forum-dx', description: 'DX, propagation og jagt.', sortOrder: 40, isSystem: true },
  { id: 5, name: 'Features/Bugs', slug: 'forum-features-bugs', description: 'Forslag, fejlmeldinger og HamHub featurelisten.', sortOrder: 90, isSystem: true },
]

export default function ForumPage() {
  const { isAuthenticated } = useAuth()
  const [rooms, setRooms] = useState<CommunityRoom[]>(fallbackRooms)
  const [threads, setThreads] = useState<Post[]>([])
  const [room, setRoom] = useState('alle')
  const [search, setSearch] = useState('')
  const [tag, setTag] = useState('')
  const [solved, setSolved] = useState<'all' | 'open' | 'solved'>('all')
  const [loading, setLoading] = useState(true)
  const [composerOpen, setComposerOpen] = useState(false)
  const [draft, setDraft] = useState({ title: '', content: '', tags: '', roomSlug: 'forum-teknik' })

  useEffect(() => {
    api.community.getForumRooms().then(items => {
      const forumRooms = Array.from(
        new Map([...fallbackRooms, ...items].map(item => [item.slug, item])).values()
      ).sort((a, b) => a.sortOrder - b.sortOrder)
      setRooms(forumRooms)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false
    const solvedFilter = solved === 'all' ? undefined : solved === 'solved'
    api.posts.getFeed(1, room, search, tag, solvedFilter, 'forum')
      .then(result => {
        if (!cancelled) setThreads(result.items)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [room, search, tag, solved])

  const tags = useMemo(() => Array.from(new Set(threads.flatMap(thread => thread.tags))).sort(), [threads])

  const startFilterChange = (apply: () => void) => {
    setLoading(true)
    apply()
  }

  const createThread = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!draft.title.trim() || !draft.content.trim()) return
    const created = await api.posts.create(draft.content, draft.roomSlug, draft.title, normalizeForumTags(draft.tags).join(','))
    setThreads(current => [created, ...current])
    setDraft({ title: '', content: '', tags: '', roomSlug: draft.roomSlug })
    setComposerOpen(false)
  }

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <div className={`${pageShellClass} space-y-5 py-6`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Forum</h1>
            <p className="mt-1 text-sm text-gray-400">Spørgsmål, løsninger og diskussioner for amatørradio.</p>
          </div>
          {isAuthenticated && <Button onClick={() => setComposerOpen(true)}>Ny tråd</Button>}
        </div>

        <section className="grid gap-2 md:grid-cols-[1fr_180px_160px_160px]">
          <input value={search} onChange={event => startFilterChange(() => setSearch(event.target.value))} placeholder="Søg i forum" className="h-10 border border-gray-800 bg-gray-900 px-3 text-sm text-white outline-none focus:border-cyan-700" />
          <select value={room} onChange={event => startFilterChange(() => setRoom(event.target.value))} className="h-10 border border-gray-800 bg-gray-900 px-3 text-sm text-white outline-none focus:border-cyan-700">
            {rooms.map(item => <option key={item.slug} value={item.slug}>{item.name}</option>)}
          </select>
          <select value={tag} onChange={event => startFilterChange(() => setTag(event.target.value))} className="h-10 border border-gray-800 bg-gray-900 px-3 text-sm text-white outline-none focus:border-cyan-700">
            <option value="">Alle tags</option>
            {tags.map(item => <option key={item} value={item}>#{item}</option>)}
          </select>
          <select value={solved} onChange={event => startFilterChange(() => setSolved(event.target.value as 'all' | 'open' | 'solved'))} className="h-10 border border-gray-800 bg-gray-900 px-3 text-sm text-white outline-none focus:border-cyan-700">
            <option value="all">Alle statusser</option>
            <option value="open">Åbne</option>
            <option value="solved">Løste</option>
          </select>
        </section>

        <div className="grid gap-3 lg:grid-cols-[260px_1fr]">
          <aside className="space-y-2">
            {rooms.map(item => (
              <button key={item.slug} type="button" onClick={() => startFilterChange(() => setRoom(item.slug))} className={`w-full border px-3 py-3 text-left ${room === item.slug ? 'border-cyan-700 bg-cyan-950/30' : 'border-gray-800 bg-gray-900 hover:border-gray-700'}`}>
                <p className="text-sm font-semibold text-white">{item.name}</p>
                <p className="mt-1 text-xs text-gray-500">{item.description}</p>
              </button>
            ))}
          </aside>

          <section className="space-y-3">
            {loading ? <div className="border border-gray-800 bg-gray-900 px-4 py-8 text-sm text-gray-400">Henter forum...</div> : threads.map(thread => (
              <ForumThreadCard key={thread.id} thread={thread} />
            ))}
            {!loading && threads.length === 0 && <div className="border border-gray-800 bg-gray-900 px-4 py-8 text-sm text-gray-500">Ingen tråde matcher filtrene.</div>}
          </section>
        </div>

        {composerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
            <form onSubmit={createThread} className="w-full max-w-2xl border border-gray-800 bg-gray-950 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-white">Ny forumtråd</h2>
                <button type="button" onClick={() => setComposerOpen(false)} className="text-sm text-gray-400 hover:text-white">Luk</button>
              </div>
              <div className="space-y-3">
                <input value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} placeholder="Titel" className="h-10 w-full border border-gray-800 bg-gray-900 px-3 text-sm text-white outline-none focus:border-cyan-700" />
                <select value={draft.roomSlug} onChange={event => setDraft(current => ({ ...current, roomSlug: event.target.value }))} className="h-10 w-full border border-gray-800 bg-gray-900 px-3 text-sm text-white outline-none focus:border-cyan-700">
                  {rooms.filter(item => item.slug !== 'alle').map(item => <option key={item.slug} value={item.slug}>{item.name}</option>)}
                </select>
                <input value={draft.tags} onChange={event => setDraft(current => ({ ...current, tags: event.target.value }))} placeholder="Tags, fx pota adif wsjtx" className="h-10 w-full border border-gray-800 bg-gray-900 px-3 text-sm text-white outline-none focus:border-cyan-700" />
                <textarea value={draft.content} onChange={event => setDraft(current => ({ ...current, content: event.target.value }))} rows={8} placeholder="Skriv dit spørgsmål eller din løsning..." className="w-full border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-700" />
                <Button type="submit">Opret tråd</Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </main>
  )
}

function ForumThreadCard({ thread }: { thread: Post }) {
  return (
    <Card className="border-gray-800 bg-gray-900">
      <CardContent className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`border px-2 py-1 text-xs font-semibold ${forumStatusClass(thread.isSolved)}`}>{forumStatusLabel(thread.isSolved)}</span>
              {thread.communityRoomName && <span className="text-xs text-gray-500">{thread.communityRoomName}</span>}
            </div>
            <Link href={`/forum/${thread.id}`} className="mt-2 block text-lg font-semibold text-white hover:text-cyan-200">
              {thread.title || thread.content.slice(0, 80)}
            </Link>
            <p className="mt-2 line-clamp-2 text-sm text-gray-400">{thread.content}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {thread.tags.map(tag => <span key={tag} className="border border-gray-700 px-2 py-1 text-xs text-gray-300">#{tag}</span>)}
            </div>
          </div>
          <div className="shrink-0 text-right text-xs text-gray-500">
            <p className="font-mono text-gray-300">{thread.authorCallsign ?? 'Ukendt'}</p>
            <p>{thread.commentCount} svar · {thread.likeCount} likes</p>
            <p>{new Date(thread.updatedAt).toLocaleString('da-DK')}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
