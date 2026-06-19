import { type MapMarker } from '@/components/ui/Map'
import { type PotaSpot, type Qso } from '@/lib/types'

export type PotaParkStatus = 'new' | 'need-qsl' | 'confirmed'

export type PotaRefProgress = {
  reference: string
  status: Exclude<PotaParkStatus, 'new'>
  qsoCount: number
  lastQsoAt: string
}

export type PotaProgress = {
  refs: Map<string, PotaRefProgress>
  workedCount: number
  confirmedCount: number
  needQslCount: number
}

export function buildPotaProgress(qsos: Qso[]): PotaProgress {
  const refs = new Map<string, PotaRefProgress>()

  for (const qso of qsos) {
    for (const reference of splitRefs(qso.potaRefs)) {
      const existing = refs.get(reference)
      const confirmed = isQsoConfirmed(qso)
      const lastQsoAt = latestDate(existing?.lastQsoAt, qso.dateUtc)
      refs.set(reference, {
        reference,
        status: existing?.status === 'confirmed' || confirmed ? 'confirmed' : 'need-qsl',
        qsoCount: (existing?.qsoCount ?? 0) + 1,
        lastQsoAt,
      })
    }
  }

  const values = Array.from(refs.values())
  return {
    refs,
    workedCount: values.length,
    confirmedCount: values.filter(ref => ref.status === 'confirmed').length,
    needQslCount: values.filter(ref => ref.status === 'need-qsl').length,
  }
}

export function potaSpotStatus(spot: PotaSpot, progress: PotaProgress): PotaParkStatus {
  const ref = progress.refs.get(normalizeRef(spot.reference))
  if (!ref) return 'new'
  return ref.status
}

export function enrichPotaMarkers(
  markers: MapMarker[],
  spots: PotaSpot[],
  progress: PotaProgress,
  statusLabel: (status: PotaParkStatus) => string = potaStatusLabel,
): MapMarker[] {
  const spotById = new Map(spots.map(spot => [String(spot.spotId), spot]))
  return markers.map(marker => {
    const spot = marker.id ? spotById.get(marker.id) : undefined
    if (!spot) return marker
    const status = potaSpotStatus(spot, progress)
    return {
      ...marker,
      variant: status === 'confirmed' ? 'worked' : status === 'need-qsl' ? 'unknown' : 'new-station',
      popup: `${marker.popup ?? marker.label}<br/><span>${statusLabel(status)}</span>`,
    }
  })
}

export function potaStatusLabel(status: PotaParkStatus) {
  if (status === 'confirmed') return 'Confirmed'
  if (status === 'need-qsl') return 'Need QSL'
  return 'New park'
}

export function splitRefs(value: string | null | undefined) {
  return (value ?? '')
    .split(/[,\s;]+/)
    .map(normalizeRef)
    .filter(Boolean)
}

function isQsoConfirmed(qso: Qso) {
  return Boolean(
    qso.lotwConfirmedAt ||
    qso.lotwQslDate ||
    qso.eqslConfirmedAt ||
    qso.qrzConfirmedAt ||
    qso.qrzConfirmationStatus?.toUpperCase() === 'C',
  )
}

function normalizeRef(value: string | null | undefined) {
  return (value ?? '').trim().toUpperCase()
}

function latestDate(left: string | undefined, right: string) {
  if (!left) return right
  return new Date(left).getTime() >= new Date(right).getTime() ? left : right
}
