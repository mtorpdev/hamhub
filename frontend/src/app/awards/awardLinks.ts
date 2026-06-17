export function awardEntityHref(entity: { qsoId: number | null }) {
  return entity.qsoId == null ? null : `/logbook/${entity.qsoId}`
}

