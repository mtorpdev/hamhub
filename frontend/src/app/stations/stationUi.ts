import { ProfileVisibility, StationType, type Station } from '@/lib/types'

export const StationTypeLabels: Record<StationType, string> = {
  [StationType.HomeShack]: 'Home shack',
  [StationType.Portable]: 'Portable',
  [StationType.Mobile]: 'Mobile',
  [StationType.Remote]: 'Remote',
  [StationType.ClubStation]: 'Club station',
  [StationType.ContestStation]: 'Contest station',
}

export const StationVisibilityLabels: Record<ProfileVisibility, string> = {
  [ProfileVisibility.Public]: 'Offentlig',
  [ProfileVisibility.MembersOnly]: 'Kun medlemmer',
  [ProfileVisibility.Private]: 'Privat',
}

export function primaryStationImage(station: Pick<Station, 'images'>) {
  return station.images[0]?.url ?? null
}

export function stationTypeLabel(type: Station['stationType']) {
  return StationTypeLabels[type] ?? 'Home shack'
}

export function stationVisibilityLabel(visibility: Station['visibility']) {
  return StationVisibilityLabels[visibility] ?? 'Privat'
}
