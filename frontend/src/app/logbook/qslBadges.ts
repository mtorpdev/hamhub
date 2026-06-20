import { type Qso } from '@/lib/types'

export type QslBadgeTone = 'confirmed' | 'pending' | 'missing'

export type QslProviderLabels = {
  confirmed: string
  pending: string
  checkedUnconfirmed: string
  verifyFailed: string
  ready: string
}

const EQSL_UPDATED_PREFIX = 'eQSL status opdateret:'
const EQSL_UPDATE_FAILED_PREFIX = 'Kunne' + ' ikke opdatere eQSL status:'
const LOTW_UPDATED_PREFIX = 'LoTW status opdateret:'
const LOTW_UPDATE_FAILED_PREFIX = 'Kunne' + ' ikke opdatere LoTW status:'

export function qrzTone(qso: Qso): QslBadgeTone {
  if (qso.qrzConfirmedAt || qso.qrzConfirmationStatus?.toUpperCase() === 'C') return 'confirmed'
  if (qso.qrzId) return 'pending'
  return 'missing'
}

export function qrzTitle(qso: Qso, labels?: Pick<QslProviderLabels, 'confirmed' | 'pending'> & { missing: string }) {
  if (qrzTone(qso) === 'confirmed') return labels?.confirmed ?? 'QRZ confirmed by the other station'
  if (qso.qrzId) return labels?.pending ?? 'QRZ registered, but not confirmed yet'
  return labels?.missing ?? 'QRZ missing or not synced'
}

export function eqslTone(qso: Qso): QslBadgeTone {
  if (qso.eqslConfirmedAt) return 'confirmed'
  if (qso.eqslSentAt) return 'pending'
  if (isEqslUpdateFailure(qso.eqslLastResult)) return 'missing'
  return 'pending'
}

export function eqslTitle(qso: Qso, labels?: QslProviderLabels) {
  if (qso.eqslConfirmedAt) return labels?.confirmed ?? 'eQSL confirmed by the other station'
  if (qso.eqslSentAt) return labels?.pending ?? 'eQSL sent, but not confirmed yet'
  if (isEqslUpdated(qso.eqslLastResult)) return labels?.checkedUnconfirmed ?? 'eQSL checked, but QSO is not confirmed yet'
  if (isEqslUpdateFailure(qso.eqslLastResult)) return labels?.verifyFailed ?? 'eQSL status could not be verified'
  return labels?.ready ?? 'eQSL is ready or has not been checked yet'
}

export function lotwTone(qso: Qso): QslBadgeTone {
  if (qso.lotwConfirmedAt || qso.lotwQslDate) return 'confirmed'
  if (isLotwUpdateFailure(qso.lotwLastResult)) return 'missing'
  return 'pending'
}

export function lotwTitle(qso: Qso, labels?: QslProviderLabels) {
  if (qso.lotwConfirmedAt || qso.lotwQslDate) return labels?.confirmed ?? 'LoTW confirmed by the other station'
  if (isLotwUpdated(qso.lotwLastResult)) return labels?.checkedUnconfirmed ?? 'LoTW checked, but QSO is not confirmed yet'
  if (isLotwUpdateFailure(qso.lotwLastResult)) return labels?.verifyFailed ?? 'LoTW status could not be verified'
  return labels?.ready ?? 'LoTW is ready or has not been checked yet'
}

function isEqslUpdated(result: string | null | undefined) {
  return result?.startsWith(EQSL_UPDATED_PREFIX) ?? false
}

function isEqslUpdateFailure(result: string | null | undefined) {
  return result?.startsWith(EQSL_UPDATE_FAILED_PREFIX) ?? false
}

function isLotwUpdated(result: string | null | undefined) {
  return result?.startsWith(LOTW_UPDATED_PREFIX) ?? false
}

function isLotwUpdateFailure(result: string | null | undefined) {
  return result?.startsWith(LOTW_UPDATE_FAILED_PREFIX) ?? false
}
