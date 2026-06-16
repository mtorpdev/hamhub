'use client'
import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { type Post, type PostComment } from '@/lib/types'
import { useAuth } from '@/contexts/AuthContext'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useToast } from '@/contexts/ToastContext'
import { formatUtcDate } from '@/lib/utils'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.hamhub.dk'

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
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-white font-semibold font-mono">{post.authorCallsign || 'Ukendt'}</span>
            {post.authorName && <span className="text-gray-500 text-sm ml-2">{post.authorName}</span>}
            <span className="text-gray-600 text-xs ml-2">{formatUtcDate(post.createdAt)}</span>
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
            className={`flex items-center gap-1.5 text-sm transition-colors ${liked ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'} ${!currentUserId ? 'cursor-default' : ''}`}
          >
            <span>{liked ? '♥' : '♡'}</span>
            <span>{likeCount}</span>
          </button>
          <button onClick={toggleComments} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300">
            <span>💬</span>
            <span>{commentCount}</span>
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
                      <button onClick={() => handleDeleteComment(c.id)} className="text-gray-700 hover:text-red-400 text-xs">×</button>
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
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [newContent, setNewContent] = useState('')
  const [newImages, setNewImages] = useState<File[]>([])
  const [posting, setPosting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = async (p = 1) => {
    setLoading(true)
    try {
      const res = await api.posts.getFeed(p)
      if (p === 1) setPosts(res.items)
      else setPosts(prev => [...prev, ...res.items])
      setTotal(res.total)
      setPage(p)
    } finally { setLoading(false) }
  }

  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false

    async function loadInitialFeed() {
      setLoading(true)
      try {
        const res = await api.posts.getFeed(1)
        if (cancelled) return
        setPosts(res.items)
        setTotal(res.total)
        setPage(1)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadInitialFeed()
    return () => { cancelled = true }
  }, [isAuthenticated])

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newContent.trim()) return
    setPosting(true)
    try {
      const post = await api.posts.create(newContent)
      for (const file of newImages) {
        try { await api.posts.uploadImage(post.id, file) } catch { /* continue */ }
      }
      setNewContent('')
      setNewImages([])
      if (fileRef.current) fileRef.current.value = ''
      await load(1)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Fejl', 'error')
    } finally { setPosting(false) }
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
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-white mb-6">Community</h1>

      <Card className="mb-6">
        <CardContent className="py-5">
          <form onSubmit={handlePost} className="flex flex-col gap-3">
            <textarea
              rows={3}
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              placeholder="Del noget med community..."
              className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white text-sm resize-none"
            />
            <div className="flex items-center justify-between">
              <label className="cursor-pointer text-gray-400 hover:text-gray-200 text-sm flex items-center gap-1">
                📷 Tilføj billeder
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
        <Card><CardContent className="py-12 text-center text-gray-400">Ingen opslag endnu. Vær den første!</CardContent></Card>
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
            <Button variant="secondary" onClick={() => load(page + 1)} disabled={loading}>
              {loading ? 'Indlæser...' : 'Indlæs flere'}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
