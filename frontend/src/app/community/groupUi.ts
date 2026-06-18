import { type CommunityContact, type CommunityGroupInvitation, type CommunityGroupMember, type CommunityRoom } from '@/lib/types'

export type GroupOverviewView = 'official' | 'mine' | 'owned' | 'discover' | 'invitations' | 'all'

export const visibilityOptions = [
  { value: 1, label: 'Offentlig', description: 'Alle kan finde og deltage i gruppen.' },
  { value: 2, label: 'Ansøg om adgang', description: 'Alle kan finde gruppen, men admin skal godkende.' },
  { value: 3, label: 'Kun inviterede', description: 'Gruppen er kun synlig for medlemmer.' },
]

export function membershipStatus(value: CommunityRoom['membershipStatus']) {
  if (value === 'Owner' || value === 1) return 'Owner'
  if (value === 'Admin' || value === 2) return 'Admin'
  if (value === 'Member' || value === 3) return 'Member'
  if (value === 'Pending' || value === 4) return 'Pending'
  return 'None'
}

export function groupVisibilityLabel(value: CommunityRoom['visibility']) {
  if (value === 'InviteOnly' || value === 3) return 'Kun inviterede'
  if (value === 'RequestToJoin' || value === 2) return 'Ansøg om adgang'
  return 'Offentlig'
}

export function groupRoleLabel(value: string | number) {
  if (value === 'Owner' || value === 1) return 'Owner'
  if (value === 'Admin' || value === 2) return 'Admin'
  return 'Medlem'
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
      label: 'Ejer',
      description: 'Du ejer gruppen og kan administrere medlemmer, ansøgninger og indstillinger.',
      tone: 'owner' as const,
    }
  }
  if (status === 'Admin') {
    return {
      label: 'Admin',
      description: 'Du kan administrere medlemmer, invitationer og ansøgninger.',
      tone: 'admin' as const,
    }
  }
  if (status === 'Member') {
    return {
      label: group.isSystem ? 'Offentlig gruppe' : 'Medlem',
      description: group.isSystem ? 'Dette er en offentlig standardgruppe i HamHub.' : 'Du er medlem af gruppen og kan deltage i samtalen.',
      tone: 'member' as const,
    }
  }
  if (status === 'Pending') {
    return {
      label: 'Ansøgning sendt',
      description: 'Din ansøgning afventer godkendelse fra gruppens administratorer.',
      tone: 'pending' as const,
    }
  }
  if (group.visibility === 'InviteOnly' || group.visibility === 3 || !group.allowJoinRequests) {
    return {
      label: 'Kun inviterede',
      description: 'Du skal inviteres af en administrator for at blive medlem.',
      tone: 'locked' as const,
    }
  }
  return {
    label: 'Ikke medlem',
    description: 'Du kan ansøge om adgang og afvente godkendelse.',
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
