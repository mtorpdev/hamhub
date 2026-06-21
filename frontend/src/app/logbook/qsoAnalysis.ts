export type AnalysisTone = 'good' | 'warning' | 'danger' | 'default'

export function scoreTone(score: number): AnalysisTone {
  if (score >= 80) return 'good'
  if (score >= 50) return 'warning'
  return 'danger'
}

export function issueTone(severity: string): AnalysisTone {
  if (severity === 'critical') return 'danger'
  if (severity === 'warning') return 'warning'
  return 'default'
}

export function sortIssues<T extends { severity: string }>(issues: T[]): T[] {
  const weight = (severity: string) => severity === 'critical' ? 0 : severity === 'warning' ? 1 : 2
  return [...issues].sort((a, b) => weight(a.severity) - weight(b.severity))
}
