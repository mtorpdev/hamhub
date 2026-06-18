export interface MergeDuplicatePayload {
  keepId: number
  duplicateIds: number[]
}

export function buildMergeDuplicatePayload(qsoIds: number[], keepId: number): MergeDuplicatePayload {
  return {
    keepId,
    duplicateIds: qsoIds.filter(id => id !== keepId),
  }
}
