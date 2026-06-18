import type { AwardProgress, AwardStatus } from '@/lib/types'

export function awardStatusLabel(status: AwardStatus) {
  if (status === 'active') return 'Aktiv'
  if (status === 'missing-data') return 'Mangler data'
  if (status === 'coming-next') return 'Kommer næste'
  return status
}

export function awardStatusClass(status: AwardStatus) {
  if (status === 'active') return 'border-emerald-800 bg-emerald-950/40 text-emerald-100'
  if (status === 'missing-data') return 'border-amber-800 bg-amber-950/40 text-amber-100'
  if (status === 'coming-next') return 'border-gray-700 bg-gray-900 text-gray-300'
  return 'border-gray-700 bg-gray-900 text-gray-300'
}

export function nextThresholdText(award: Pick<AwardProgress, 'workedCount' | 'nextThreshold'>) {
  if (!award.nextThreshold || award.workedCount >= award.nextThreshold) return 'Niveau opnået'
  return `${award.nextThreshold - award.workedCount} til næste niveau`
}

export function progressPercent(award: Pick<AwardProgress, 'workedCount' | 'nextThreshold'>) {
  if (!award.nextThreshold || award.nextThreshold <= 0) return 100
  return Math.min(100, Math.round((award.workedCount / award.nextThreshold) * 100))
}

export function awardEntitySectionLabel(status: 'confirmed' | 'worked' | 'missing') {
  if (status === 'confirmed') return 'Confirmed entities'
  if (status === 'worked') return 'Worked, needs QSL'
  return 'Missing entities'
}

export function buildAwardGroups(awards: AwardProgress[]) {
  const bySponsor = new Map<string, AwardProgress[]>()
  for (const award of awards) {
    const group = bySponsor.get(award.sponsor) ?? []
    group.push(award)
    bySponsor.set(award.sponsor, group)
  }

  return Array.from(bySponsor.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([sponsor, groupAwards]) => ({
      sponsor,
      awards: groupAwards.sort((left, right) =>
        statusRank(left.status) - statusRank(right.status) ||
        right.workedCount - left.workedCount ||
        left.name.localeCompare(right.name)),
    }))
}

export function buildAwardWorkflowStats(awards: Pick<AwardProgress, 'workedCount' | 'confirmedCount' | 'missingCount' | 'unconfirmedEntities'>[]) {
  return awards.reduce((stats, award) => ({
    worked: stats.worked + award.workedCount,
    confirmed: stats.confirmed + award.confirmedCount,
    needsQsl: stats.needsQsl + award.unconfirmedEntities.length,
    missing: stats.missing + award.missingCount,
  }), { worked: 0, confirmed: 0, needsQsl: 0, missing: 0 })
}

function statusRank(status: AwardStatus) {
  if (status === 'active') return 0
  if (status === 'missing-data') return 1
  if (status === 'coming-next') return 2
  return 3
}
