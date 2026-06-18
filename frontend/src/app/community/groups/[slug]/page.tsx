'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { type CommunityContact, type CommunityGroupJoinRequest, type CommunityGroupMember, type CommunityRoom, type Post } from '@/lib/types'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { formatUtcDate } from '@/lib/utils'
import { groupRoleLabel, groupVisibilityLabel, membershipStatus, visibilityOptions } from '../../groupUi'

export default function CommunityGroupDetailPage() {
  const params = useParams()
  const router = useRouter()
  const slug = String(params.slug ?? '')
  const { user } = useAuth()
  const { toast } = useToast()
  const [group, setGroup] = useState<CommunityRoom | null>(null)
  const [members, setMembers] = useState<CommunityGroupMember[]>([])
  const [requests, setRequests] = useState<CommunityGroupJoinRequest[]>([])
  const [contacts, setContacts] = useState<CommunityContact[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [postText, setPostText] = useState('')
  const [editDraft, setEditDraft] = useState({ name: '', description: '', visibility: 1, allowJoinRequests: true })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const status = membershipStatus(group?.membershipStatus)
  const canManage = status === 'Owner' || status === 'Admin'
  const canOwn = status === 'Owner'
  const canPost = status === 'Owner' || status === 'Admin' || status === 'Member' || group?.visibility === 1 || group?.visibility === 'Public'

  const memberIds = useMemo(() => new Set(members.map(member => member.userId)), [members])
  const inviteCandidates = contacts.filter(contact => !memberIds.has(contact.id))

  const loadGroup = async () => {
    if (!slug) return
    const loaded = await api.community.getGroupBySlug(slug)
    setGroup(loaded)
    setEditDraft({
      name: loaded.name,
      description: loaded.description ?? '',
      visibility: Number(loaded.visibility ?? 1),
      allowJoinRequests: loaded.allowJoinRequests ?? true,
    })
    const [memberData, feedData, contactData] = await Promise.all([
      api.community.getGroupMembers(loaded.id).catch(() => []),
      api.posts.getFeed(1, loaded.slug, undefined, undefined, undefined, 'community').catch(() => ({ items: [] as Post[], total: 0, page: 1, pageSize: 20 })),
      api.community.getContacts().catch(() => []),
    ])
    setMembers(memberData)
    setPosts(feedData.items)
    setContacts(contactData)
    if (membershipStatus(loaded.membershipStatus) === 'Owner' || membershipStatus(loaded.membershipStatus) === 'Admin') {
      setRequests(await api.community.getGroupJoinRequests(loaded.id).catch(() => []))
    } else {
      setRequests([])
    }
  }

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      try {
        await loadGroup()
      } catch {
        if (!cancelled) setGroup(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  const requestToJoin = async () => {
    if (!group) return
    setSaving(true)
    try {
      await api.community.requestToJoinGroup(group.id)
      await loadGroup()
      toast('Ansøgning sendt')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Kunne ikke sende ansøgning', 'error')
    } finally {
      setSaving(false)
    }
  }

  const submitPost = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!group || !postText.trim()) return
    setSaving(true)
    try {
      await api.posts.create(postText, group.slug)
      setPostText('')
      await loadGroup()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Kunne ikke oprette opslag', 'error')
    } finally {
      setSaving(false)
    }
  }

  const saveSettings = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!group) return
    setSaving(true)
    try {
      await api.community.updateGroup(group.id, editDraft)
      await loadGroup()
      toast('Gruppe opdateret')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Kunne ikke gemme gruppe', 'error')
    } finally {
      setSaving(false)
    }
  }

  const approveRequest = async (requestId: number) => {
    if (!group) return
    await api.community.approveGroupJoinRequest(group.id, requestId)
    await loadGroup()
  }

  const rejectRequest = async (requestId: number) => {
    if (!group) return
    await api.community.rejectGroupJoinRequest(group.id, requestId)
    await loadGroup()
  }

  const updateRole = async (memberId: string, role: number) => {
    if (!group) return
    await api.community.updateGroupMemberRole(group.id, memberId, role)
    await loadGroup()
  }

  const removeMember = async (memberId: string) => {
    if (!group || !window.confirm('Fjern medlem fra gruppen?')) return
    await api.community.removeGroupMember(group.id, memberId)
    await loadGroup()
  }

  const inviteContact = async (contactId: string) => {
    if (!group) return
    await api.community.inviteToGroup(group.id, contactId)
    toast('Invitation sendt')
  }

  const archiveGroup = async () => {
    if (!group || !window.confirm('Arkiver gruppen? Den forsvinder fra grupperne.')) return
    await api.community.archiveGroup(group.id)
    router.push('/community')
  }

  if (loading) return <main className="mx-auto max-w-[1280px] px-4 py-8 text-gray-400">Henter gruppe...</main>
  if (!group) return <main className="mx-auto max-w-[1280px] px-4 py-8 text-gray-400">Gruppe ikke fundet.</main>

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <Link href="/community" className="text-sm text-blue-300 hover:text-blue-200">Tilbage til Grupper</Link>
          <h1 className="mt-2 text-3xl font-bold text-white">{group.name}</h1>
          <p className="mt-1 text-sm text-gray-500">{group.description || 'Ingen beskrivelse endnu.'}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-400">
            <span className="rounded border border-gray-700 px-2 py-1">{groupVisibilityLabel(group.visibility)}</span>
            <span className="rounded border border-gray-700 px-2 py-1">{group.memberCount ?? members.length} medlemmer</span>
            <span className="rounded border border-gray-700 px-2 py-1">{status === 'None' ? 'Ikke medlem' : status}</span>
          </div>
        </div>
        {status === 'None' && group.allowJoinRequests && <Button onClick={requestToJoin} disabled={saving}>Ansøg om adgang</Button>}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-4">
          <Card>
            <CardContent className="py-5">
              <form onSubmit={submitPost} className="space-y-3">
                <textarea
                  rows={4}
                  value={postText}
                  onChange={event => setPostText(event.target.value)}
                  disabled={!canPost}
                  placeholder={canPost ? 'Del noget med gruppen...' : 'Du skal være medlem for at skrive her.'}
                  className="w-full resize-none rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white disabled:opacity-50"
                />
                <Button type="submit" disabled={saving || !postText.trim() || !canPost}>Post</Button>
              </form>
            </CardContent>
          </Card>

          {posts.map(post => (
            <Card key={post.id}>
              <CardContent className="py-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="font-mono text-sm text-blue-200">{post.authorCallsign || 'Ukendt'}</span>
                  <span className="text-xs text-gray-600">{formatUtcDate(post.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-gray-200">{post.content}</p>
              </CardContent>
            </Card>
          ))}
          {posts.length === 0 && <Card><CardContent className="py-10 text-center text-sm text-gray-500">Ingen opslag i gruppen endnu.</CardContent></Card>}
        </section>

        <aside className="space-y-4">
          <Card>
            <CardContent className="py-5">
              <h2 className="mb-3 text-sm font-semibold text-white">Medlemmer</h2>
              <div className="space-y-2">
                {members.map(member => (
                  <div key={member.userId} className="rounded border border-gray-800 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-mono text-sm text-gray-100">{member.callsign || member.email}</div>
                        <div className="text-xs text-gray-500">{groupRoleLabel(member.role)}</div>
                      </div>
                      {canOwn && member.userId !== user?.id && groupRoleLabel(member.role) !== 'Owner' && (
                        <button type="button" onClick={() => removeMember(member.userId)} className="text-xs text-red-300 hover:text-red-200">Fjern</button>
                      )}
                    </div>
                    {canOwn && groupRoleLabel(member.role) !== 'Owner' && (
                      <select value={member.role === 'Admin' || member.role === 2 ? 2 : 3} onChange={event => updateRole(member.userId, Number(event.target.value))} className="mt-2 h-8 w-full rounded border border-gray-700 bg-gray-900 px-2 text-xs text-white">
                        <option value={3}>Medlem</option>
                        <option value={2}>Admin</option>
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {canManage && requests.length > 0 && (
            <Card>
              <CardContent className="py-5">
                <h2 className="mb-3 text-sm font-semibold text-white">Ansøgninger</h2>
                <div className="space-y-2">
                  {requests.map(request => (
                    <div key={request.id} className="rounded border border-gray-800 p-3">
                      <div className="text-sm text-gray-100">{request.callsign || request.email}</div>
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" onClick={() => approveRequest(request.id)}>Godkend</Button>
                        <Button size="sm" variant="secondary" onClick={() => rejectRequest(request.id)}>Afvis</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {canManage && inviteCandidates.length > 0 && (
            <Card>
              <CardContent className="py-5">
                <h2 className="mb-3 text-sm font-semibold text-white">Inviter kontakt</h2>
                <div className="flex flex-wrap gap-2">
                  {inviteCandidates.slice(0, 16).map(contact => (
                    <Button key={contact.id} size="sm" variant="secondary" onClick={() => inviteContact(contact.id)}>
                      {contact.callsign || contact.email}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {canOwn && !group.isSystem && (
            <Card>
              <CardContent className="py-5">
                <h2 className="mb-3 text-sm font-semibold text-white">Indstillinger</h2>
                <form onSubmit={saveSettings} className="space-y-3">
                  <input value={editDraft.name} onChange={event => setEditDraft(current => ({ ...current, name: event.target.value }))} className="h-10 w-full rounded border border-gray-700 bg-gray-900 px-3 text-sm text-white" />
                  <textarea value={editDraft.description} onChange={event => setEditDraft(current => ({ ...current, description: event.target.value }))} rows={3} className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white" />
                  <select value={editDraft.visibility} onChange={event => setEditDraft(current => ({ ...current, visibility: Number(event.target.value) }))} className="h-10 w-full rounded border border-gray-700 bg-gray-900 px-3 text-sm text-white">
                    {visibilityOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  {editDraft.visibility !== 3 && (
                    <label className="flex items-center gap-2 text-sm text-gray-300">
                      <input type="checkbox" checked={editDraft.allowJoinRequests} onChange={event => setEditDraft(current => ({ ...current, allowJoinRequests: event.target.checked }))} />
                      Tillad ansøgninger
                    </label>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={saving}>Gem</Button>
                    <Button type="button" variant="danger" onClick={archiveGroup}>Arkiver</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </main>
  )
}
