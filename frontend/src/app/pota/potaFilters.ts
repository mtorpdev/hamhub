import { type MapMarker } from '@/components/ui/Map'
import { type PotaSpot } from '@/lib/types'

export type PotaFilters = {
  search?: string
  band?: string
  mode?: string
  activator?: string
}

export function filterPotaSpots(spots: PotaSpot[], filters: PotaFilters): PotaSpot[] {
  const search = normalize(filters.search)
  const activator = normalize(filters.activator)
  const band = normalize(filters.band)
  const mode = normalize(filters.mode)

  return spots.filter(spot => {
    if (band && normalize(spot.band) !== band) return false
    if (mode && normalize(spot.mode) !== mode) return false
    if (activator && !normalize(spot.activator).includes(activator)) return false
    if (!search) return true

    return [
      spot.activator,
      spot.reference,
      spot.parkName,
      spot.locationDesc,
      spot.grid4,
      spot.grid6,
      spot.mode,
      spot.band,
      spot.comments,
    ].some(value => normalize(value).includes(search))
  })
}

export function potaBandOptions(spots: PotaSpot[]) {
  return uniqueSorted(spots.map(spot => spot.band).filter(Boolean) as string[], compareBands)
}

export function potaModeOptions(spots: PotaSpot[]) {
  return uniqueSorted(spots.map(spot => spot.mode).filter(Boolean))
}

export function buildPotaMapMarkers(spots: PotaSpot[]): MapMarker[] {
  return spots.flatMap(spot => {
    if (spot.latitude === null || spot.latitude === undefined || spot.longitude === null || spot.longitude === undefined) return []

    const label = `${spot.activator} ${spot.reference}`
    return [{
      id: String(spot.spotId),
      lat: spot.latitude,
      lng: spot.longitude,
      label,
      variant: 'new-station' as const,
      tooltip: [
        label,
        spot.band,
        spot.mode,
        spot.frequency ? `${spot.frequency} kHz` : null,
      ].filter(Boolean).join(' · '),
      popup: [
        `<b>${escapeHtml(spot.activator)}</b>`,
        escapeHtml(spot.reference),
        spot.parkName ? escapeHtml(spot.parkName) : null,
        `${escapeHtml(spot.frequency)} kHz · ${escapeHtml(spot.mode)}`,
        spot.comments ? escapeHtml(spot.comments) : null,
      ].filter(Boolean).join('<br/>'),
    }]
  })
}

export function spotAgeMinutes(spotTimeUtc: string, now = new Date()) {
  const then = new Date(spotTimeUtc).getTime()
  if (Number.isNaN(then)) return null
  return Math.max(0, Math.round((now.getTime() - then) / 60000))
}

function normalize(value: string | null | undefined) {
  return (value ?? '').trim().toUpperCase()
}

function uniqueSorted(values: string[], compare?: (left: string, right: string) => number) {
  return Array.from(new Set(values.filter(Boolean))).sort(compare)
}

function compareBands(left: string, right: string) {
  return bandOrder(left) - bandOrder(right) || left.localeCompare(right)
}

function bandOrder(band: string) {
  const value = Number(band.toLowerCase().replace(/m|cm/g, ''))
  if (band.toLowerCase().endsWith('cm')) return value / 100
  return Number.isFinite(value) ? value : 9999
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
