import assert from 'node:assert/strict'
import test from 'node:test'
import { ProfileVisibility, StationType, type Station } from '@/lib/types'
import { primaryStationImage, stationTypeLabel, stationVisibilityLabel } from './stationUi'

const station: Station = {
  id: 1,
  userId: 'user-1',
  name: 'Main shack',
  callsign: 'OZ1ABC',
  radioEquipment: 'IC-7300',
  antennaDescription: 'Hexbeam',
  powerOutput: 100,
  location: 'Home QTH',
  gridLocator: 'JO55WM',
  stationType: StationType.HomeShack,
  description: 'HF desk',
  visibility: ProfileVisibility.Public,
  supportedModes: [],
  supportedBands: [],
  images: [{ id: 1, url: '/uploads/stations/shack.webp' }],
  createdAt: '2026-06-18T00:00:00Z',
}

test('labels station type and visibility for station profiles', () => {
  assert.equal(stationTypeLabel(StationType.HomeShack), 'Home shack')
  assert.equal(stationTypeLabel(StationType.Portable), 'Portable')
  assert.equal(stationVisibilityLabel(ProfileVisibility.Public), 'Offentlig')
  assert.equal(stationVisibilityLabel(ProfileVisibility.Private), 'Privat')
})

test('returns the first station image for cards', () => {
  assert.equal(primaryStationImage(station), '/uploads/stations/shack.webp')
  assert.equal(primaryStationImage({ ...station, images: [] }), null)
})
