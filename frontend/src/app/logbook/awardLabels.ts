import type { Qso } from '@/lib/types'

export type QsoAwardLabelTone = 'dxcc' | 'zone' | 'reference' | 'county'

export interface QsoAwardLabel {
  key: string
  text: string
  title: string
  tone: QsoAwardLabelTone
}

export function buildQsoAwardLabels(qso: Qso): QsoAwardLabel[] {
  const labels: QsoAwardLabel[] = []

  if (qso.dxcc) labels.push(label('dxcc', `DXCC ${qso.dxcc}`, qso.country ? `DXCC ${qso.dxcc}: ${qso.country}` : `DXCC ${qso.dxcc}`, 'dxcc'))
  if (qso.cqZone) labels.push(label('cq', `CQ ${qso.cqZone}`, `CQ zone ${qso.cqZone}`, 'zone'))
  if (qso.ituZone) labels.push(label('itu', `ITU ${qso.ituZone}`, `ITU zone ${qso.ituZone}`, 'zone'))
  if (hasText(qso.iota)) labels.push(label('iota', `IOTA ${qso.iota.trim()}`, `IOTA ${qso.iota.trim()}`, 'reference'))

  const potaRefs = splitRefs(qso.potaRefs)
  if (potaRefs.length === 1) labels.push(label('pota', `POTA ${potaRefs[0]}`, `POTA ${potaRefs[0]}`, 'reference'))
  else if (potaRefs.length > 1) labels.push(label('pota', `POTA ${potaRefs.length}`, `POTA refs: ${potaRefs.join(', ')}`, 'reference'))

  const sotaRefs = splitRefs(qso.sotaRefs)
  if (sotaRefs.length === 1) labels.push(label('sota', `SOTA ${sotaRefs[0]}`, `SOTA ${sotaRefs[0]}`, 'reference'))
  else if (sotaRefs.length > 1) labels.push(label('sota', `SOTA ${sotaRefs.length}`, `SOTA refs: ${sotaRefs.join(', ')}`, 'reference'))

  if (hasText(qso.county)) labels.push(label('county', `CNTY ${qso.county.trim()}`, `County ${qso.county.trim()}`, 'county'))

  return labels
}

function label(key: string, text: string, title: string, tone: QsoAwardLabelTone): QsoAwardLabel {
  return { key, text, title, tone }
}

function hasText(value: string | null | undefined): value is string {
  return Boolean(value?.trim())
}

function splitRefs(value: string | null | undefined) {
  if (!hasText(value)) return []
  return value
    .split(/[,\s;]+/)
    .map(item => item.trim())
    .filter(Boolean)
}

