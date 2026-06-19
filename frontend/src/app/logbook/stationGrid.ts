import type { Station, User } from '@/lib/types'

export function stationGrid(station: Station | null | undefined) {
  const grid = station?.gridLocator?.trim().toUpperCase()
  return grid || ''
}

export function defaultStation(stations: Station[], user: Pick<User, 'defaultStationId'> | null | undefined) {
  return stations.find(station => station.id === user?.defaultStationId) ?? null
}

export function stationById(stations: Station[], stationId: string | number | null | undefined) {
  if (stationId === null || stationId === undefined || stationId === '') return null
  const id = Number(stationId)
  return stations.find(station => station.id === id) ?? null
}

export function stationOptionLabel(station: Station) {
  const details = [station.callsign, stationGrid(station), station.location].filter(Boolean)
  return details.length > 0 ? `${station.name} (${details.join(' - ')})` : station.name
}
