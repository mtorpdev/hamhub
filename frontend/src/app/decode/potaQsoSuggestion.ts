import { BandLabels, ModeLabels, type PotaSpot, type Qso } from '@/lib/types'
import { type QsoEditForm } from './qsoEdit'

export type PotaQsoSuggestion = {
  reference: string
  activator: string
  parkName: string | null
  spotTimeUtc: string
  source: string | null
}

const MAX_SPOT_AGE_MINUTES = 120

export function findPotaSuggestionForQso(qso: Qso, spots: PotaSpot[]): PotaQsoSuggestion | null {
  if (qso.potaRefs?.trim()) return null

  const qsoCall = normalizeCallsign(qso.workedCallsign)
  const qsoBand = normalize(BandLabels[qso.band])
  const qsoMode = normalize(ModeLabels[qso.mode])
  const qsoTime = new Date(qso.dateUtc).getTime()
  if (!qsoCall || Number.isNaN(qsoTime)) return null

  const matches = spots
    .map(spot => ({ spot, minutes: Math.abs(new Date(spot.spotTimeUtc).getTime() - qsoTime) / 60000 }))
    .filter(({ spot, minutes }) =>
      Number.isFinite(minutes) &&
      minutes <= MAX_SPOT_AGE_MINUTES &&
      normalizeCallsign(spot.activator) === qsoCall &&
      normalize(spot.band) === qsoBand &&
      normalize(spot.mode) === qsoMode &&
      Boolean(spot.reference?.trim()))
    .sort((left, right) => left.minutes - right.minutes)

  const best = matches[0]?.spot
  if (!best) return null

  return {
    reference: best.reference.trim().toUpperCase(),
    activator: best.activator,
    parkName: best.parkName,
    spotTimeUtc: best.spotTimeUtc,
    source: best.source,
  }
}

export function applyPotaSuggestionToForm(form: QsoEditForm, suggestion: PotaQsoSuggestion | null): QsoEditForm {
  if (!suggestion || form.potaRefs.trim()) return form
  return { ...form, potaRefs: suggestion.reference }
}

function normalize(value: string | null | undefined) {
  return (value ?? '').trim().toUpperCase()
}

function normalizeCallsign(value: string | null | undefined) {
  return normalize(value).replace(/\/(P|M|MM|AM|QRP|[0-9])$/u, '')
}
