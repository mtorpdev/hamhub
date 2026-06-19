import { type CommunityContact, type CommunityGroupInvitation, type CommunityGroupMember, type CommunityRoom } from '@/lib/types'

export type GroupOverviewView = 'official' | 'mine' | 'owned' | 'discover' | 'invitations' | 'all'

export const visibilityOptions = [
  { value: 1, label: 'Public', description: 'Everyone can find and join the group.' },
  { value: 2, label: 'Request to join', description: 'Everyone can find the group, but admins must approve membership.' },
  { value: 3, label: 'Invite only', description: 'The group is only visible to members.' },
]

export function membershipStatus(value: CommunityRoom['membershipStatus']) {
  if (value === 'Owner' || value === 1) return 'Owner'
  if (value === 'Admin' || value === 2) return 'Admin'
  if (value === 'Member' || value === 3) return 'Member'
  if (value === 'Pending' || value === 4) return 'Pending'
  return 'None'
}

export function groupVisibilityLabel(value: CommunityRoom['visibility']) {
  if (value === 'InviteOnly' || value === 3) return 'Invite only'
  if (value === 'RequestToJoin' || value === 2) return 'Request to join'
  return 'Public'
}

export function groupRoleLabel(value: string | number) {
  if (value === 'Owner' || value === 1) return 'Owner'
  if (value === 'Admin' || value === 2) return 'Admin'
  return 'Member'
}

export function canManageCommunityGroup(group: Pick<CommunityRoom, 'membershipStatus'> | null | undefined) {
  const status = membershipStatus(group?.membershipStatus)
  return status === 'Owner' || status === 'Admin'
}

export function canOwnCommunityGroup(group: Pick<CommunityRoom, 'membershipStatus'> | null | undefined) {
  return membershipStatus(group?.membershipStatus) === 'Owner'
}

export function buildGroupAccessSummary(group: Pick<CommunityRoom, 'membershipStatus' | 'visibility' | 'allowJoinRequests' | 'isSystem'>) {
  const status = membershipStatus(group.membershipStatus)
  if (status === 'Owner') {
    return {
      label: 'Owner',
      description: 'You own this group and can manage members, requests and settings.',
      tone: 'owner' as const,
    }
  }
  if (status === 'Admin') {
    return {
      label: 'Admin',
      description: 'You can manage members, invitations and requests.',
      tone: 'admin' as const,
    }
  }
  if (status === 'Member') {
    return {
      label: group.isSystem ? 'Public group' : 'Member',
      description: group.isSystem ? 'This is a public default group in HamHub.' : 'You are a member of this group and can join the conversation.',
      tone: 'member' as const,
    }
  }
  if (status === 'Pending') {
    return {
      label: 'Request sent',
      description: 'Your request is waiting for approval from the group administrators.',
      tone: 'pending' as const,
    }
  }
  if (group.visibility === 'InviteOnly' || group.visibility === 3 || !group.allowJoinRequests) {
    return {
      label: 'Invite only',
      description: 'You need an invitation from an administrator to become a member.',
      tone: 'locked' as const,
    }
  }
  return {
    label: 'Not a member',
    description: 'You can request access and wait for approval.',
    tone: 'neutral' as const,
  }
}

export function filterInviteCandidates(contacts: CommunityContact[], members: CommunityGroupMember[], search: string) {
  const memberIds = new Set(members.map(member => member.userId))
  const term = search.trim().toLowerCase()
  return contacts
    .filter(contact => !memberIds.has(contact.id))
    .filter(contact => !term
      || (contact.callsign ?? '').toLowerCase().includes(term)
      || (contact.email ?? '').toLowerCase().includes(term)
      || (contact.name ?? '').toLowerCase().includes(term))
    .sort((a, b) => (a.callsign ?? a.name ?? a.email ?? '').localeCompare(b.callsign ?? b.name ?? b.email ?? ''))
}

export function filterCommunityGroups(groups: CommunityRoom[], view: GroupOverviewView, search: string) {
  const term = search.trim().toLowerCase()
  return groups.filter(group => {
    const status = membershipStatus(group.membershipStatus)
    const matchesView = view === 'all'
      || view === 'invitations'
      || (view === 'official' && group.isSystem)
      || (view === 'mine' && !group.isSystem && status !== 'None' && status !== 'Pending')
      || (view === 'owned' && !group.isSystem && status === 'Owner')
      || (view === 'discover' && !group.isSystem && (status === 'None' || status === 'Pending'))
    const matchesSearch = !term
      || group.name.toLowerCase().includes(term)
      || (group.description ?? '').toLowerCase().includes(term)
    return matchesView && matchesSearch
  })
}

export function groupOverviewCounts(groups: CommunityRoom[], invitations: CommunityGroupInvitation[]) {
  return {
    official: filterCommunityGroups(groups, 'official', '').length,
    mine: filterCommunityGroups(groups, 'mine', '').length,
    owned: filterCommunityGroups(groups, 'owned', '').length,
    discover: filterCommunityGroups(groups, 'discover', '').length,
    invitations: invitations.length,
  }
}
