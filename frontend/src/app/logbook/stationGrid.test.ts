import assert from 'node:assert/strict'
import test from 'node:test'
import { defaultStation, stationById, stationGrid, stationOptionLabel } from './stationGrid'
import { ProfileVisibility, StationType, type Station } from '@/lib/types'

const baseStation: Station = {
  id: 7,
  userId: 'user-1',
  name: 'Home shack',
  callsign: 'OZ4MT',
  radioEquipment: null,
  antennaDescription: null,
  powerOutput: null,
  location: 'Aalborg',
  gridLocator: ' jo65dq ',
  stationType: StationType.HomeShack,
  description: null,
  visibility: ProfileVisibility.Private,
  supportedModes: [],
  supportedBands: [],
  images: [],
  createdAt: '2026-06-19T00:00:00Z',
}

test('normalizes station grid for QSO forms', () => {
  assert.equal(stationGrid(baseStation), 'JO65DQ')
})

test('finds default station and station by select value', () => {
  const portable = { ...baseStation, id: 8, name: 'Portable', gridLocator: 'JO55WM' }
  assert.equal(defaultStation([baseStation, portable], { defaultStationId: 8 })?.name, 'Portable')
  assert.equal(stationById([baseStation, portable], '7')?.name, 'Home shack')
})

test('builds readable station option labels', () => {
  assert.equal(stationOptionLabel(baseStation), 'Home shack (OZ4MT - JO65DQ - Aalborg)')
})
