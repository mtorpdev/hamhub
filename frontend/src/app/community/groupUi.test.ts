import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildGroupAccessSummary,
  canManageCommunityGroup,
  filterCommunityGroups,
  filterInviteCandidates,
  groupOverviewCounts,
} from './groupUi'
import { type CommunityContact, type CommunityGroupInvitation, type CommunityGroupMember, type CommunityRoom } from '@/lib/types'

const groups: CommunityRoom[] = [
  { id: 1, name: 'Alle grupper', slug: 'alle', description: null, sortOrder: 0, isSystem: true, membershipStatus: 3, memberCount: 0 },
  { id: 2, name: 'OZ Club', slug: 'oz-club', description: 'Local club', sortOrder: 10, isSystem: false, membershipStatus: 1, memberCount: 4 },
  { id: 3, name: 'POTA Hunters', slug: 'pota-hunters', description: 'Parks', sortOrder: 20, isSystem: false, membershipStatus: 0, memberCount: 12 },
  { id: 4, name: 'DX', slug: 'dx', description: 'DX spots', sortOrder: 30, isSystem: true, membershipStatus: 3, memberCount: 0 },
]

const invitations: CommunityGroupInvitation[] = [
  { id: 1, communityRoomId: 5, groupName: 'Invite Only Club', inviterCallsign: 'OZ1ABC', createdAt: '2026-06-18T00:00:00Z' },
]

const members: CommunityGroupMember[] = [
  { userId: 'u1', callsign: 'OZ1OWN', email: 'owner@example.com', name: 'Owner', role: 1, createdAt: '2026-06-18T00:00:00Z' },
  { userId: 'u2', callsign: 'OZ2MEM', email: 'member@example.com', name: 'Member', role: 3, createdAt: '2026-06-18T00:00:00Z' },
]

const contacts: CommunityContact[] = [
  { id: 'u1', callsign: 'OZ1OWN', email: 'owner@example.com', name: 'Owner', profileImageUrl: null, gridLocator: null, country: null },
  { id: 'u3', callsign: 'OZ3ABC', email: 'abc@example.com', name: 'Alpha Beta', profileImageUrl: null, gridLocator: null, country: null },
  { id: 'u4', callsign: 'OZ4XYZ', email: 'xyz@example.com', name: 'Club Friend', profileImageUrl: null, gridLocator: null, country: null },
]

test('filters groups into mine and discover views', () => {
  assert.deepEqual(filterCommunityGroups(groups, 'official', '').map(group => group.slug), ['alle', 'dx'])
  assert.deepEqual(filterCommunityGroups(groups, 'mine', '').map(group => group.slug), ['oz-club'])
  assert.deepEqual(filterCommunityGroups(groups, 'owned', '').map(group => group.slug), ['oz-club'])
  assert.deepEqual(filterCommunityGroups(groups, 'discover', '').map(group => group.slug), ['pota-hunters'])
})

test('searches groups by name and description', () => {
  assert.deepEqual(filterCommunityGroups(groups, 'all', 'parks').map(group => group.slug), ['pota-hunters'])
  assert.deepEqual(filterCommunityGroups(groups, 'all', 'club').map(group => group.slug), ['oz-club'])
})

test('summarizes group overview badges', () => {
  assert.deepEqual(groupOverviewCounts(groups, invitations), {
    official: 2,
    mine: 1,
    owned: 1,
    discover: 1,
    invitations: 1,
  })
})

test('labels group access and management permissions', () => {
  assert.equal(canManageCommunityGroup({ ...groups[1], membershipStatus: 2 }), true)
  assert.equal(canManageCommunityGroup({ ...groups[1], membershipStatus: 3 }), false)

  assert.deepEqual(buildGroupAccessSummary({ ...groups[1], membershipStatus: 1 }), {
    label: 'Ejer',
    description: 'Du ejer gruppen og kan administrere medlemmer, ansøgninger og indstillinger.',
    tone: 'owner',
  })
  assert.deepEqual(buildGroupAccessSummary({ ...groups[2], membershipStatus: 4 }), {
    label: 'Ansøgning sendt',
    description: 'Din ansøgning afventer godkendelse fra gruppens administratorer.',
    tone: 'pending',
  })
})

test('filters invite candidates by membership and search text', () => {
  assert.deepEqual(filterInviteCandidates(contacts, members, '').map(contact => contact.id), ['u3', 'u4'])
  assert.deepEqual(filterInviteCandidates(contacts, members, 'xyz').map(contact => contact.id), ['u4'])
  assert.deepEqual(filterInviteCandidates(contacts, members, 'alpha').map(contact => contact.id), ['u3'])
})
