import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPotaMapMarkers, filterPotaSpots, potaBandOptions, potaModeOptions } from './potaFilters'
import { type PotaSpot } from '@/lib/types'

const baseSpot: PotaSpot = {
  spotId: 1,
  activator: 'OZ4MT/P',
  frequency: '14074',
  frequencyKhz: 14074,
  band: '20m',
  mode: 'FT8',
  reference: 'DK-0001',
  parkName: 'Mols Bjerge National Park',
  locationDesc: 'DK',
  grid4: 'JO56',
  grid6: 'JO56aa',
  latitude: 56.22,
  longitude: 10.48,
  spotter: 'OZ1ABC',
  comments: 'CQ POTA',
  source: 'GT',
  spotTimeUtc: '2026-06-18T05:19:47Z',
  expiresInSeconds: 1600,
}

test('filters POTA spots by search, band, mode, and activator callsign', () => {
  const spots: PotaSpot[] = [
    baseSpot,
    { ...baseSpot, spotId: 2, activator: 'K1ABC', reference: 'US-0001', parkName: 'Acadia', band: '40m', frequencyKhz: 7074 },
    { ...baseSpot, spotId: 3, activator: 'OZ5POTA/P', reference: 'DK-0022', parkName: 'Skagen', mode: 'CW' },
  ]

  const filtered = filterPotaSpots(spots, {
    search: 'mols',
    band: '20m',
    mode: 'FT8',
    activator: 'oz4mt',
  })

  assert.deepEqual(filtered.map(spot => spot.spotId), [1])
})

test('builds unique band and mode options from current spots', () => {
  const spots: PotaSpot[] = [
    baseSpot,
    { ...baseSpot, spotId: 2, band: '40m', mode: 'CW' },
    { ...baseSpot, spotId: 3, band: '20m', mode: 'FT8' },
  ]

  assert.deepEqual(potaBandOptions(spots), ['20m', '40m'])
  assert.deepEqual(potaModeOptions(spots), ['CW', 'FT8'])
})

test('builds map markers only for spots with coordinates', () => {
  const markers = buildPotaMapMarkers([
    baseSpot,
    { ...baseSpot, spotId: 2, latitude: null, longitude: 10.1 },
  ])

  const marker = assertSingle(markers)
  assert.equal(marker.id, '1')
  assert.equal(marker.lat, 56.22)
  assert.equal(marker.lng, 10.48)
  assert.equal(marker.label, 'OZ4MT/P DK-0001')
  assert.equal(marker.variant, 'new-station')
  assert.match(marker.popup ?? '', /Mols Bjerge/)
})

function assertSingle<T>(items: T[]): T {
  assert.equal(items.length, 1)
  return items[0]
}
