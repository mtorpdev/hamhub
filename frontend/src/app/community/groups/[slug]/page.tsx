'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { type CommunityContact, type CommunityGroupJoinRequest, type CommunityGroupMember, type CommunityRoom, type Post } from '@/lib/types'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useLanguage } from '@/i18n/LanguageContext'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { formatUtcDate } from '@/lib/utils'
import {
  canManageCommunityGroup,
  canOwnCommunityGroup,
  filterInviteCandidates,
  membershipStatus,
} from '../../groupUi'

export default function CommunityGroupDetailPage() {
  const params = useParams()
  const router = useRouter()
  const slug = String(params.slug ?? '')
  const { user } = useAuth()
  const { toast } = useToast()
  const { t } = useLanguage()
  const [group, setGroup] = useState<CommunityRoom | null>(null)
  const [members, setMembers] = useState<CommunityGroupMember[]>([])
  const [requests, setRequests] = useState<CommunityGroupJoinRequest[]>([])
  const [contacts, setContacts] = useState<CommunityContact[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [postText, setPostText] = useState('')
  const [editDraft, setEditDraft] = useState({ name: '', description: '', visibility: 1, allowJoinRequests: true })
  const [inviteSearch, setInviteSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const status = membershipStatus(group?.membershipStatus)
  const canManage = canManageCommunityGroup(group)
  const canOwn = canOwnCommunityGroup(group)
  const canPost = status === 'Owner' || status === 'Admin' || status === 'Member' || group?.visibility === 1 || group?.visibility === 'Public'

  const inviteCandidates = useMemo(
    () => filterInviteCandidates(contacts, members, inviteSearch),
    [contacts, members, inviteSearch],
  )

  const visibilityOptions = useMemo(() => [
    { value: 1, label: t('community.visibility.public') },
    { value: 2, label: t('community.visibility.request') },
    { value: 3, label: t('community.visibility.inviteOnly') },
  ], [t])

  const visibilityLabel = (value: CommunityRoom['visibility']) => {
    if (value === 'InviteOnly' || value === 3) return t('community.visibility.inviteOnly')
    if (value === 'RequestToJoin' || value === 2) return t('community.visibility.request')
    return t('community.visibility.public')
  }

  const roleLabel = (value: string | number) => {
    if (value === 'Owner' || value === 1) return t('community.role.owner')
    if (value === 'Admin' || value === 2) return t('community.role.admin')
    return t('community.role.member')
  }

  const accessSummary = group ? accessSummaryForGroup(group, t) : null

  const loadGroup = async () => {
    if (!slug) return
    const loaded = await api.community.getGroupBySlug(slug)
    const presented = presentCommunityGroup(loaded, t)
    setGroup(presented)
    setEditDraft({
      name: presented.name,
      description: presented.description ?? '',
      visibility: Number(presented.visibility ?? 1),
      allowJoinRequests: presented.allowJoinRequests ?? true,
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
      toast(t('community.group.requestSent'))
    } catch (err) {
      toast(err instanceof Error ? err.message : t('community.group.requestFailed'), 'error')
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
      toast(err instanceof Error ? err.message : t('community.group.createPostFailed'), 'error')
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
      toast(t('community.group.updated'))
    } catch (err) {
      toast(err instanceof Error ? err.message : t('community.group.saveFailed'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const approveRequest = async (requestId: number) => {
    if (!group) return
    setActionLoading(`approve-${requestId}`)
    try {
      await api.community.approveGroupJoinRequest(group.id, requestId)
      await loadGroup()
      toast(t('community.group.approved'))
    } catch (err) {
      toast(err instanceof Error ? err.message : t('community.group.approveFailed'), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const rejectRequest = async (requestId: number) => {
    if (!group) return
    setActionLoading(`reject-${requestId}`)
    try {
      await api.community.rejectGroupJoinRequest(group.id, requestId)
      await loadGroup()
      toast(t('community.group.rejected'))
    } catch (err) {
      toast(err instanceof Error ? err.message : t('community.group.rejectFailed'), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const updateRole = async (memberId: string, role: number) => {
    if (!group) return
    setActionLoading(`role-${memberId}`)
    try {
      await api.community.updateGroupMemberRole(group.id, memberId, role)
      await loadGroup()
      toast(t('community.group.roleUpdated'))
    } catch (err) {
      toast(err instanceof Error ? err.message : t('community.group.roleFailed'), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const removeMember = async (memberId: string) => {
    if (!group || !window.confirm(t('community.group.removeMemberConfirm'))) return
    setActionLoading(`remove-${memberId}`)
    try {
      await api.community.removeGroupMember(group.id, memberId)
      await loadGroup()
      toast(t('community.group.memberRemoved'))
    } catch (err) {
      toast(err instanceof Error ? err.message : t('community.group.removeMemberFailed'), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const inviteContact = async (contactId: string) => {
    if (!group) return
    setActionLoading(`invite-${contactId}`)
    try {
      await api.community.inviteToGroup(group.id, contactId)
      toast(t('community.group.invitationSent'))
    } catch (err) {
      toast(err instanceof Error ? err.message : t('community.group.invitationFailed'), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const archiveGroup = async () => {
    if (!group || !window.confirm(t('community.group.archiveConfirm'))) return
    setActionLoading('archive')
    try {
      await api.community.archiveGroup(group.id)
      router.push('/community')
    } catch (err) {
      toast(err instanceof Error ? err.message : t('community.group.archiveFailed'), 'error')
      setActionLoading(null)
    }
  }

  if (loading) return <main className="mx-auto max-w-[1280px] px-4 py-8 text-gray-400">{t('community.group.loading')}</main>
  if (!group) return <main className="mx-auto max-w-[1280px] px-4 py-8 text-gray-400">{t('community.group.notFound')}</main>

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <Link href="/community" className="text-sm text-blue-300 hover:text-blue-200">{t('community.group.back')}</Link>
          <h1 className="mt-2 text-3xl font-bold text-white">{group.name}</h1>
          <p className="mt-1 text-sm text-gray-500">{group.description || t('community.group.noDescription')}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-400">
            <span className="rounded border border-gray-700 px-2 py-1">{visibilityLabel(group.visibility)}</span>
            <span className="rounded border border-gray-700 px-2 py-1">{t('community.group.membersCount', { count: group.memberCount ?? members.length })}</span>
            <span className="rounded border border-gray-700 px-2 py-1">{accessSummary?.label}</span>
          </div>
        </div>
        {status === 'None' && group.allowJoinRequests && <Button onClick={requestToJoin} disabled={saving}>{t('community.group.requestAccess')}</Button>}
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
                  placeholder={canPost ? t('community.group.postPlaceholder') : t('community.group.memberOnlyPlaceholder')}
                  className="w-full resize-none rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white disabled:opacity-50"
                />
                <Button type="submit" disabled={saving || !postText.trim() || !canPost}>{t('common.post')}</Button>
              </form>
            </CardContent>
          </Card>

          {posts.map(post => (
            <Card key={post.id}>
              <CardContent className="py-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="font-mono text-sm text-blue-200">{post.authorCallsign || t('community.group.unknownAuthor')}</span>
                  <span className="text-xs text-gray-600">{formatUtcDate(post.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-gray-200">{post.content}</p>
              </CardContent>
            </Card>
          ))}
          {posts.length === 0 && <Card><CardContent className="py-10 text-center text-sm text-gray-500">{t('community.group.noPosts')}</CardContent></Card>}
        </section>

        <aside className="space-y-4">
          {accessSummary && (
            <Card>
              <CardContent className="py-5">
                <div className="text-xs uppercase tracking-wide text-gray-500">{t('community.group.yourAccess')}</div>
                <div className="mt-2 text-lg font-semibold text-white">{accessSummary.label}</div>
                <p className="mt-1 text-sm text-gray-400">{accessSummary.description}</p>
                {canManage && (
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                    <Metric label={t('community.group.members')} value={members.length} />
                    <Metric label={t('community.group.requests')} value={requests.length} />
                    <Metric label={t('community.group.canInvite')} value={inviteCandidates.length} />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="py-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-white">{t('community.group.members')}</h2>
                <span className="text-xs text-gray-500">{members.length}</span>
              </div>
              <div className="space-y-2">
                {members.map(member => (
                  <div key={member.userId} className="rounded border border-gray-800 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-mono text-sm text-gray-100">{member.callsign || member.email}</div>
                        <div className="text-xs text-gray-500">
                          {roleLabel(member.role)}
                          {member.name ? ` - ${member.name}` : ''}
                        </div>
                      </div>
                      {canOwn && member.userId !== user?.id && roleLabel(member.role) !== t('community.role.owner') && (
                        <button type="button" onClick={() => removeMember(member.userId)} disabled={actionLoading === `remove-${member.userId}`} className="text-xs text-red-300 hover:text-red-200 disabled:opacity-50">{t('common.remove')}</button>
                      )}
                    </div>
                    {canOwn && roleLabel(member.role) !== t('community.role.owner') && (
                      <select value={member.role === 'Admin' || member.role === 2 ? 2 : 3} disabled={actionLoading === `role-${member.userId}`} onChange={event => updateRole(member.userId, Number(event.target.value))} className="mt-2 h-8 w-full rounded border border-gray-700 bg-gray-900 px-2 text-xs text-white disabled:opacity-50">
                        <option value={3}>{t('community.role.member')}</option>
                        <option value={2}>{t('community.role.admin')}</option>
                      </select>
                    )}
                  </div>
                ))}
                {members.length === 0 && <div className="rounded border border-dashed border-gray-800 p-4 text-sm text-gray-500">{t('community.group.noMembers')}</div>}
              </div>
            </CardContent>
          </Card>

          {canManage && (
            <Card>
              <CardContent className="py-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-white">{t('community.group.applications')}</h2>
                  <span className="text-xs text-gray-500">{requests.length}</span>
                </div>
                <div className="space-y-2">
                  {requests.map(request => (
                    <div key={request.id} className="rounded border border-gray-800 p-3">
                      <div className="text-sm text-gray-100">{request.callsign || request.email}</div>
                      <div className="text-xs text-gray-500">{formatUtcDate(request.createdAt)}</div>
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" onClick={() => approveRequest(request.id)} disabled={actionLoading === `approve-${request.id}`}>{t('community.group.approve')}</Button>
                        <Button size="sm" variant="secondary" onClick={() => rejectRequest(request.id)} disabled={actionLoading === `reject-${request.id}`}>{t('messages.decline')}</Button>
                      </div>
                    </div>
                  ))}
                  {requests.length === 0 && <div className="rounded border border-dashed border-gray-800 p-4 text-sm text-gray-500">{t('community.group.noPendingRequests')}</div>}
                </div>
              </CardContent>
            </Card>
          )}

          {canManage && (
            <Card>
              <CardContent className="py-5">
                <h2 className="mb-3 text-sm font-semibold text-white">{t('community.group.inviteContact')}</h2>
                <input
                  value={inviteSearch}
                  onChange={event => setInviteSearch(event.target.value)}
                  placeholder={t('community.group.inviteSearch')}
                  className="mb-3 h-9 w-full rounded border border-gray-700 bg-gray-900 px-3 text-sm text-white placeholder:text-gray-600"
                />
                <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto">
                  {inviteCandidates.slice(0, 16).map(contact => (
                    <Button key={contact.id} size="sm" variant="secondary" onClick={() => inviteContact(contact.id)} disabled={actionLoading === `invite-${contact.id}`}>
                      {contact.callsign || contact.email}
                    </Button>
                  ))}
                </div>
                {inviteCandidates.length === 0 && (
                  <p className="text-sm text-gray-500">
                    {contacts.length === 0 ? t('community.group.noContacts') : t('community.group.noContactMatches')}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {canOwn && !group.isSystem && (
            <Card>
              <CardContent className="py-5">
                <h2 className="mb-3 text-sm font-semibold text-white">{t('community.group.settings')}</h2>
                <form onSubmit={saveSettings} className="space-y-3">
                  <input value={editDraft.name} onChange={event => setEditDraft(current => ({ ...current, name: event.target.value }))} className="h-10 w-full rounded border border-gray-700 bg-gray-900 px-3 text-sm text-white" />
                  <textarea value={editDraft.description} onChange={event => setEditDraft(current => ({ ...current, description: event.target.value }))} rows={3} className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white" />
                  <select value={editDraft.visibility} onChange={event => setEditDraft(current => ({ ...current, visibility: Number(event.target.value) }))} className="h-10 w-full rounded border border-gray-700 bg-gray-900 px-3 text-sm text-white">
                    {visibilityOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  {editDraft.visibility !== 3 && (
                    <label className="flex items-center gap-2 text-sm text-gray-300">
                      <input type="checkbox" checked={editDraft.allowJoinRequests} onChange={event => setEditDraft(current => ({ ...current, allowJoinRequests: event.target.checked }))} />
                      {t('community.group.allowJoinRequests')}
                    </label>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={saving}>{t('common.save')}</Button>
                    <Button type="button" variant="danger" onClick={archiveGroup} disabled={actionLoading === 'archive'}>{t('community.group.archive')}</Button>
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

function presentCommunityGroup(group: CommunityRoom, t: ReturnType<typeof useLanguage>['t']): CommunityRoom {
  if (!group.isSystem) return group
  if (group.slug === 'dx') return { ...group, name: 'DX', description: t('community.rooms.dxDescription') }
  if (group.slug === 'ft8-ft4') return { ...group, name: 'FT8/FT4', description: t('community.rooms.digitalDescription') }
  if (group.slug === 'teknik') return { ...group, name: t('community.rooms.tech'), description: t('community.rooms.techDescription') }
  if (group.slug === 'koeb-salg') return { ...group, name: t('community.rooms.market'), description: t('community.rooms.marketDescription') }
  if (group.slug === 'pota-sota-awards') return { ...group, name: 'POTA / SOTA / Awards', description: t('community.rooms.potaDescription') }
  return group
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-gray-800 bg-gray-900/50 px-2 py-2">
      <div className="text-lg font-semibold text-white">{value}</div>
      <div className="text-gray-500">{label}</div>
    </div>
  )
}

function accessSummaryForGroup(group: Pick<CommunityRoom, 'membershipStatus' | 'visibility' | 'allowJoinRequests' | 'isSystem'>, t: ReturnType<typeof useLanguage>['t']) {
  const status = membershipStatus(group.membershipStatus)
  if (status === 'Owner') return { label: t('community.role.owner'), description: t('community.group.access.owner.description') }
  if (status === 'Admin') return { label: t('community.role.admin'), description: t('community.group.access.admin.description') }
  if (status === 'Member') return {
    label: group.isSystem ? t('community.access.publicGroup') : t('community.role.member'),
    description: group.isSystem ? t('community.group.access.public.description') : t('community.group.access.member.description'),
  }
  if (status === 'Pending') return { label: t('community.access.requestSent'), description: t('community.group.access.pending.description') }
  if (group.visibility === 'InviteOnly' || group.visibility === 3 || !group.allowJoinRequests) return {
    label: t('community.visibility.inviteOnly'),
    description: t('community.group.access.inviteOnly.description'),
  }
  return { label: t('community.access.notMember'), description: t('community.group.access.notMember.description') }
}
