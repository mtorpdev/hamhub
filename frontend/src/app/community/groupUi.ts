import { type CommunityRoom } from '@/lib/types'

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
