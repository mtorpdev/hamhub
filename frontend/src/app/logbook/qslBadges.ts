import { type Qso } from '@/lib/types'

export type QslBadgeTone = 'confirmed' | 'pending' | 'missing'

export function qrzTone(qso: Qso): QslBadgeTone {
  if (qso.qrzConfirmedAt || qso.qrzConfirmationStatus?.toUpperCase() === 'C') return 'confirmed'
  if (qso.qrzId) return 'pending'
  return 'missing'
}

export function qrzTitle(qso: Qso) {
  if (qrzTone(qso) === 'confirmed') return 'QRZ bekræftet af modparten'
  if (qso.qrzId) return 'QRZ registreret, men ikke bekræftet endnu'
  return 'QRZ mangler eller er ikke synkroniseret'
}

export function eqslTone(qso: Qso): QslBadgeTone {
  if (qso.eqslConfirmedAt) return 'confirmed'
  if (qso.eqslSentAt) return 'pending'
  if (qso.eqslLastResult?.startsWith('Kunne ikke opdatere eQSL status:')) return 'missing'
  return 'pending'
}

export function eqslTitle(qso: Qso) {
  if (qso.eqslConfirmedAt) return 'eQSL bekræftet af modparten'
  if (qso.eqslSentAt) return 'eQSL sendt, men ikke bekræftet endnu'
  if (qso.eqslLastResult?.startsWith('eQSL status opdateret:')) return 'eQSL tjekket, men QSO er ikke bekræftet endnu'
  if (qso.eqslLastResult?.startsWith('Kunne ikke opdatere eQSL status:')) return 'eQSL status kunne ikke verificeres'
  return 'eQSL er klar eller ikke tjekket endnu'
}

export function lotwTone(qso: Qso): QslBadgeTone {
  if (qso.lotwConfirmedAt || qso.lotwQslDate) return 'confirmed'
  if (qso.lotwLastResult?.startsWith('LoTW status opdateret:')) return 'missing'
  if (qso.lotwLastResult?.startsWith('Kunne ikke opdatere LoTW status:')) return 'missing'
  return 'pending'
}

export function lotwTitle(qso: Qso) {
  if (qso.lotwConfirmedAt || qso.lotwQslDate) return 'LoTW bekræftet af modparten'
  if (qso.lotwLastResult?.startsWith('LoTW status opdateret:')) return 'LoTW tjekket, men QSO er ikke bekræftet endnu'
  if (qso.lotwLastResult?.startsWith('Kunne ikke opdatere LoTW status:')) return 'LoTW status kunne ikke verificeres'
  return 'LoTW er klar eller ikke tjekket endnu'
}
