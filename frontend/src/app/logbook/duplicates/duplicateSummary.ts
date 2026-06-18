import type { QsoDuplicateGroup } from '@/lib/types'

export interface DuplicateSummary {
  groups: number
  qsos: number
  latestDateUtc: string | null
}

export function buildDuplicateSummary(groups: QsoDuplicateGroup[]): DuplicateSummary {
  const dates = groups.flatMap(group => group.qsos.map(qso => qso.dateUtc))

  return {
    groups: groups.length,
    qsos: groups.reduce((total, group) => total + group.qsos.length, 0),
    latestDateUtc: dates.length > 0
      ? dates.reduce((latest, date) => date > latest ? date : latest)
      : null,
  }
}
