import { Band, Mode, type Qso } from '@/lib/types'

export type QsoEditForm = {
  dateUtc: string
  ownCallsign: string
  workedCallsign: string
  band: Band | string
  frequency: string
  mode: Mode | string
  rstSent: string
  rstReceived: string
  submode: string
  locator: string
  myGridsquare: string
  country: string
  dxcc: string
  continent: string
  state: string
  iota: string
  name: string
  qth: string
  txPower: string
  comment: string
}

export const EMPTY_QSO_FORM: QsoEditForm = {
  dateUtc: '',
  ownCallsign: '',
  workedCallsign: '',
  band: Band.M20,
  frequency: '',
  mode: Mode.FT8,
  rstSent: '',
  rstReceived: '',
  submode: '',
  locator: '',
  myGridsquare: '',
  country: '',
  dxcc: '',
  continent: '',
  state: '',
  iota: '',
  name: '',
  qth: '',
  txPower: '',
  comment: '',
}

export function qsoToEditForm(qso: Qso): QsoEditForm {
  return {
    dateUtc: new Date(qso.dateUtc).toISOString().slice(0, 16),
    ownCallsign: qso.ownCallsign,
    workedCallsign: qso.workedCallsign,
    band: qso.band,
    frequency: qso.frequency?.toString() ?? '',
    mode: qso.mode,
    rstSent: qso.rstSent ?? '',
    rstReceived: qso.rstReceived ?? '',
    submode: qso.submode ?? '',
    locator: qso.locator ?? '',
    myGridsquare: qso.myGridsquare ?? '',
    country: qso.country ?? '',
    dxcc: qso.dxcc?.toString() ?? '',
    continent: qso.continent ?? '',
    state: qso.state ?? '',
    iota: qso.iota ?? '',
    name: qso.name ?? '',
    qth: qso.qth ?? '',
    txPower: qso.txPower?.toString() ?? '',
    comment: qso.comment ?? '',
  }
}

export function qsoFormPayload(form: QsoEditForm) {
  return {
    ...form,
    dateUtc: new Date(form.dateUtc).toISOString(),
    band: Number(form.band),
    mode: Number(form.mode),
    frequency: form.frequency ? parseFloat(form.frequency) : undefined,
    dxcc: form.dxcc ? parseInt(form.dxcc, 10) : undefined,
    txPower: form.txPower ? parseFloat(form.txPower) : undefined,
  }
}
