import assert from 'node:assert/strict'
import test from 'node:test'
import { filterCommunityGroups, groupOverviewCounts } from './groupUi'
import { type CommunityGroupInvitation, type CommunityRoom } from '@/lib/types'

const groups: CommunityRoom[] = [
  { id: 1, name: 'Alle grupper', slug: 'alle', description: null, sortOrder: 0, isSystem: true, membershipStatus: 3, memberCount: 0 },
  { id: 2, name: 'OZ Club', slug: 'oz-club', description: 'Local club', sortOrder: 10, isSystem: false, membershipStatus: 1, memberCount: 4 },
  { id: 3, name: 'POTA Hunters', slug: 'pota-hunters', description: 'Parks', sortOrder: 20, isSystem: false, membershipStatus: 0, memberCount: 12 },
  { id: 4, name: 'DX', slug: 'dx', description: 'DX spots', sortOrder: 30, isSystem: true, membershipStatus: 3, memberCount: 0 },
]

const invitations: CommunityGroupInvitation[] = [
  { id: 1, communityRoomId: 5, groupName: 'Invite Only Club', inviterCallsign: 'OZ1ABC', createdAt: '2026-06-18T00:00:00Z' },
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
