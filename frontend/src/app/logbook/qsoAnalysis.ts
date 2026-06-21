export type AnalysisTone = 'good' | 'warning' | 'danger' | 'default'
export type DuplicateRiskLevel = 'low' | 'medium' | 'high'

export function scoreTone(score: number): AnalysisTone {
  if (score >= 80) return 'good'
  if (score >= 50) return 'warning'
  return 'danger'
}

export function duplicateRiskTone(score: number): AnalysisTone {
  if (score >= 80) return 'danger'
  if (score >= 50) return 'warning'
  return 'good'
}

export function duplicateRiskLevel(score: number): DuplicateRiskLevel {
  if (score >= 80) return 'high'
  if (score >= 50) return 'medium'
  return 'low'
}

export function issueTone(severity: string): AnalysisTone {
  if (severity === 'critical') return 'danger'
  if (severity === 'warning') return 'warning'
  return 'default'
}

export function qslStatusLabelKey(status: string): string | null {
  if (status === 'confirmed') return 'logbook.analysis.qslStatus.confirmed'
  if (status === 'synced') return 'logbook.analysis.qslStatus.synced'
  if (status === 'ready') return 'logbook.analysis.qslStatus.ready'
  if (status === 'missing') return 'logbook.analysis.qslStatus.missing'
  return null
}

export function issueSeverityLabelKey(severity: string): string | null {
  if (severity === 'critical') return 'logbook.analysis.issueSeverity.critical'
  if (severity === 'warning') return 'logbook.analysis.issueSeverity.warning'
  if (severity === 'info') return 'logbook.analysis.issueSeverity.info'
  return null
}

export function sortIssues<T extends { severity: string }>(issues: T[]): T[] {
  const weight = (severity: string) => severity === 'critical' ? 0 : severity === 'warning' ? 1 : 2
  return [...issues].sort((a, b) => weight(a.severity) - weight(b.severity))
}
