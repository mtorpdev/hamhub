export type AnalysisTone = 'good' | 'warning' | 'danger' | 'default'
export type DuplicateRiskLevel = 'low' | 'medium' | 'high'

export function analysisBadgeVariant(tone: AnalysisTone): 'default' | 'success' | 'warning' | 'info' {
  if (tone === 'good') return 'success'
  if (tone === 'warning' || tone === 'danger') return 'warning'
  return 'default'
}

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
  if (status === 'activity') return 'logbook.analysis.qslStatus.activity'
  if (status === 'credential-error') return 'logbook.analysis.qslStatus.credentialError'
  if (status === 'missing') return 'logbook.analysis.qslStatus.missing'
  if (status === 'none') return 'logbook.analysis.qslStatus.none'
  if (status === 'not-configured') return 'logbook.analysis.qslStatus.notConfigured'
  if (status === 'ready') return 'logbook.analysis.qslStatus.ready'
  if (status === 'sent') return 'logbook.analysis.qslStatus.sent'
  if (status === 'logged') return 'logbook.analysis.qslStatus.logged'
  if (status === 'synced') return 'logbook.analysis.qslStatus.synced'
  return null
}

export function issueSeverityLabelKey(severity: string): string | null {
  if (severity === 'critical') return 'logbook.analysis.issueSeverity.critical'
  if (severity === 'warning') return 'logbook.analysis.issueSeverity.warning'
  if (severity === 'info') return 'logbook.analysis.issueSeverity.info'
  return null
}

export function flagLabelKey(key: string): string | null {
  if (key === 'confirmed') return 'logbook.analysis.flag.confirmed'
  if (key === 'missing-data') return 'logbook.analysis.flag.missingData'
  if (key === 'duplicate-risk') return 'logbook.analysis.flag.duplicateRisk'
  return null
}

export function sortIssues<T extends { severity: string }>(issues: T[]): T[] {
  const weight = (severity: string) => severity === 'critical' ? 0 : severity === 'warning' ? 1 : 2
  return [...issues].sort((a, b) => weight(a.severity) - weight(b.severity))
}
