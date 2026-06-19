export function normalizeForumTags(value: string | null | undefined) {
  return Array.from(new Set((value ?? '')
    .split(/[,\s;]+/)
    .map(tag => tag.trim().replace(/^#/, '').toLowerCase())
    .filter(Boolean)))
    .slice(0, 8)
}

export function forumStatusLabel(isSolved: boolean) {
  return isSolved ? 'Solved' : 'Open'
}

export function forumStatusClass(isSolved: boolean) {
  return isSolved
    ? 'border-emerald-700 bg-emerald-950/40 text-emerald-200'
    : 'border-cyan-800 bg-cyan-950/40 text-cyan-100'
}
