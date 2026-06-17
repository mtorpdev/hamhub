import { type Qso } from '@/lib/types'

export function nextLoggedQsoPopupId(previousQsos: Qso[] | null, currentQsos: Qso[], dismissedIds: Set<number>) {
  if (previousQsos === null) return null

  const previousIds = new Set(previousQsos.map(qso => qso.id))
  const newQso = currentQsos.find(qso => !previousIds.has(qso.id) && !dismissedIds.has(qso.id))
  return newQso?.id ?? null
}
