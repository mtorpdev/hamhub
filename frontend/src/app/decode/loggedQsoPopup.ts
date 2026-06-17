import { type Qso } from '@/lib/types'

export function nextLoggedQsoPopupId(previousQsos: Qso[] | null, currentQsos: Qso[], dismissedIds: Set<number>) {
  if (previousQsos === null) return null

  const previousIds = new Set(previousQsos.map(qso => qso.id))
  const newQso = currentQsos.find(qso => !previousIds.has(qso.id) && !dismissedIds.has(qso.id))
  return newQso?.id ?? null
}

export function syncLoggedQsoPopupSnapshot(
  previousQsos: Qso[] | null,
  currentQsos: Qso[],
  dismissedIds: Set<number>,
  qsosLoaded: boolean,
) {
  if (!qsosLoaded) return { nextId: null, snapshot: previousQsos }
  if (previousQsos === null) return { nextId: null, snapshot: currentQsos }

  return {
    nextId: nextLoggedQsoPopupId(previousQsos, currentQsos, dismissedIds),
    snapshot: currentQsos,
  }
}
