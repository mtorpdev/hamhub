'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { AllCommunityModule, ModuleRegistry, type ColDef, type RowClassRules, type RowClickedEvent } from 'ag-grid-community'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/contexts/AuthContext'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { api } from '@/lib/api'
import { distanceKm, gridToLatLng } from '@/lib/maidenhead'
import LeafletMap, { type MapMarker } from '@/components/ui/Map'
import { Band, BandLabels, Mode, ModeLabels, type Qso, type WsjtxDecodeItem, type WsjtxStatus } from '@/lib/types'

ModuleRegistry.registerModules([AllCommunityModule])

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.hamhub.dk'
const MAX_ROWS = 200

type DecodeRow = WsjtxDecodeItem & {
  distanceKm: number | null
  logStatus: DecodeLogStatus
  displayMode: string
  country: string
  continent: string
  prefix: string
  callsMe: boolean
  canRespond: boolean
  isNewBandMode: boolean
  wantedReasons: WantedReason[]
  awardReasons: AwardReason[]
}

type DecodeLogStatus = 'worked' | 'new-grid' | 'new-station' | 'unknown'
type WantedReason = 'calling-me' | 'new-grid' | 'new-station' | 'new-band-mode' | 'worked'
type AwardReason = 'dxcc' | 'continent' | 'grid' | 'wpx' | 'band-mode' | 'calling-me' | 'worked'
type AwardFilter = 'dxcc' | 'continent' | 'grid' | 'wpx' | 'band-mode'
type MessageFilter = 'all' | 'CQ' | 'me' | '73'
type DecodeView = 'grid' | 'map' | 'wanted' | 'awards'
type DecodeMapMarker = MapMarker & {
  decodeId: number
}

type LogbookIndex = {
  callsigns: Set<string>
  grids: Set<string>
  bandModeSlots: Set<string>
  countries: Set<string>
  continents: Set<string>
  prefixes: Set<string>
  byCallsign: Map<string, Qso>
}

type AwardCountryStatus = {
  country: string
  continent: string
  worked: boolean
  liveCount: number
  liveNeeded: boolean
  bestSnr: number | null
  latest: DecodeRow | null
}

type QsoEditForm = {
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

const EMPTY_QSO_FORM: QsoEditForm = {
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

const EMPTY_LOGBOOK_INDEX: LogbookIndex = {
  callsigns: new Set(),
  grids: new Set(),
  bandModeSlots: new Set(),
  countries: new Set(),
  continents: new Set(),
  prefixes: new Set(),
  byCallsign: new Map(),
}

const DEFAULT_AWARD_FILTERS: Record<AwardFilter, boolean> = {
  dxcc: true,
  continent: true,
  grid: true,
  wpx: true,
  'band-mode': true,
}

const CONTINENTS = ['EU', 'NA', 'SA', 'AF', 'AS', 'OC', 'AN'] as const
const CONTINENT_LABELS: Record<string, string> = {
  EU: 'Europa',
  NA: 'Nordamerika',
  SA: 'Sydamerika',
  AF: 'Afrika',
  AS: 'Asien',
  OC: 'Oceanien',
  AN: 'Antarktis',
}

const COUNTRY_CONTINENTS: Record<string, string> = {
  'australien': 'OC',
  'belgien': 'EU',
  'bulgarien': 'EU',
  'canada': 'NA',
  'danmark': 'EU',
  'frankrig': 'EU',
  'graekenland': 'EU',
  'grækenland': 'EU',
  'holland': 'EU',
  'indonesien': 'OC',
  'italien': 'EU',
  'japan': 'AS',
  'kasakhstan': 'AS',
  'kina/taiwan': 'AS',
  'kroatien': 'EU',
  'nederlandene': 'EU',
  'new zealand': 'OC',
  'nordirland': 'EU',
  'norge': 'EU',
  'polen': 'EU',
  'rumænien': 'EU',
  'rumaenien': 'EU',
  'rusland': 'EU',
  'schweiz': 'EU',
  'skotland': 'EU',
  'slovakiet': 'EU',
  'slovenien': 'EU',
  'spanien': 'EU',
  'sverige': 'EU',
  'sydkorea': 'AS',
  'tjekkiet': 'EU',
  'tyrkiet': 'AS',
  'tyskland': 'EU',
  'ungarn': 'EU',
  'usa': 'NA',
  'wales': 'EU',
  'østrig': 'EU',
  'oestrig': 'EU',
  'austria': 'EU',
  'belgium': 'EU',
  'bulgaria': 'EU',
  'croatia': 'EU',
  'czech republic': 'EU',
  'denmark': 'EU',
  'england': 'EU',
  'finland': 'EU',
  'france': 'EU',
  'germany': 'EU',
  'greece': 'EU',
  'hungary': 'EU',
  'israel': 'AS',
  'italy': 'EU',
  'netherlands': 'EU',
  'norway': 'EU',
  'poland': 'EU',
  'romania': 'EU',
  'russia': 'EU',
  'slovakia': 'EU',
  'slovenia': 'EU',
  'spain': 'EU',
  'sweden': 'EU',
  'switzerland': 'EU',
  'turkey': 'AS',
  'ukraine': 'EU',
  'united states': 'NA',
}

const CALLSIGN_COUNTRY_PREFIXES: Array<[RegExp, string]> = [
  [/^(?:OZ|OU|OV|OX|OY)/, 'Danmark'],
  [/^(?:DL|DA|DB|DC|DD|DE|DF|DG|DH|DJ|DK|DM|DN|DO|DP|DQ|DR)/, 'Tyskland'],
  [/^(?:EA|EB|EC|ED|EE|EF|AM|AN|AO)/, 'Spanien'],
  [/^(?:F|TM|TO|TX)/, 'Frankrig'],
  [/^(?:G|M|2E|2M|2W)/, 'England'],
  [/^(?:GM|MM)/, 'Skotland'],
  [/^(?:GW|MW)/, 'Wales'],
  [/^(?:GI|MI)/, 'Nordirland'],
  [/^(?:I|IK|IW|IZ|IU|II|IR)/, 'Italien'],
  [/^(?:PA|PB|PC|PD|PE|PF|PG|PH|PI)/, 'Nederlandene'],
  [/^(?:ON|OO|OP|OQ|OR|OS|OT)/, 'Belgien'],
  [/^(?:SM|SA|SB|SC|SD|SE|SF|SG|SH|SI|SJ|SK|SL)/, 'Sverige'],
  [/^(?:LA|LB|LC|LD|LE|LF|LG|LH|LI|LJ|LK|LL|LM|LN)/, 'Norge'],
  [/^(?:OH|OF|OG|OI)/, 'Finland'],
  [/^(?:SP|SQ|SN|SO|HF|3Z)/, 'Polen'],
  [/^(?:OK|OL)/, 'Tjekkiet'],
  [/^(?:OM)/, 'Slovakiet'],
  [/^(?:OE)/, 'Ostrig'],
  [/^(?:HB9|HE|HB)/, 'Schweiz'],
  [/^(?:S5)/, 'Slovenien'],
  [/^(?:9A)/, 'Kroatien'],
  [/^(?:HA|HG)/, 'Ungarn'],
  [/^(?:YO|YR|YP|YQ)/, 'Rumaenien'],
  [/^(?:LZ)/, 'Bulgarien'],
  [/^(?:SV|SX|SY|SZ)/, 'Graekenland'],
  [/^(?:TA|TC)/, 'Tyrkiet'],
  [/^(?:UR|US|UT|UU|UV|UW|UX|UY|UZ|EM|EN|EO)/, 'Ukraine'],
  [/^(?:R|RA|RB|RC|RD|RE|RF|RG|RJ|RK|RL|RM|RN|RO|RQ|RT|RU|RV|RW|RX|RY|RZ|UA|UB|UC|UD|UF|UG|UI)/, 'Rusland'],
  [/^(?:UN|UP|UQ)/, 'Kasakhstan'],
  [/^(?:4X|4Z)/, 'Israel'],
  [/^(?:JA|JE|JF|JG|JH|JI|JJ|JK|JL|JM|JN|JO|JP|JQ|JR|JS|7J|7K|7L|7M|7N|8J|8N)/, 'Japan'],
  [/^(?:HL|DS|DT|D7|D8|D9|6K|6L|6M|6N)/, 'Sydkorea'],
  [/^(?:BY|BD|BG|BH|BI|BJ|BL|BM|BN|BO|BP|BQ|BR|BS|BT|BU|BV|BW|BX)/, 'Kina/Taiwan'],
  [/^(?:VK|AX|VI|VJ|VL|VM|VN|VZ)/, 'Australien'],
  [/^(?:ZL|ZM)/, 'New Zealand'],
  [/^(?:YB|YC|YD|YE|YF|YG|YH)/, 'Indonesien'],
  [/^(?:VE|VA|VO|VY)/, 'Canada'],
  [/^(?:K|N|W|AA|AB|AC|AD|AE|AF|AG|AI|AJ|AK)/, 'USA'],
]

function snrText(snr: number) {
  return snr > 0 ? `+${snr}` : String(snr)
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('da-DK', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function isRelatedMessage(decode: WsjtxDecodeItem, selected: WsjtxDecodeItem) {
  const own = selected.spotterCallsign?.toUpperCase()
  const dx = selected.dxCallsign?.toUpperCase()
  const message = decode.message.toUpperCase()
  return Boolean((own && message.includes(own)) || (dx && message.includes(dx)))
}

function buildLogbookIndex(qsos: Qso[]): LogbookIndex {
  const callsigns = new Set<string>()
  const grids = new Set<string>()
  const bandModeSlots = new Set<string>()
  const countries = new Set<string>()
  const continents = new Set<string>()
  const prefixes = new Set<string>()
  const byCallsign = new Map<string, Qso>()

  for (const qso of qsos) {
    const call = qso.workedCallsign?.toUpperCase()
    if (call) {
      callsigns.add(call)
      if (!byCallsign.has(call)) byCallsign.set(call, qso)
      bandModeSlots.add(bandModeKey(call, qso.band, qso.mode))
      const prefix = callsignPrefix(call)
      if (prefix) prefixes.add(prefix)
    }

    const grid = qso.locator?.toUpperCase()
    if (grid) grids.add(grid)

    const country = normalizeCountry(qso.country)
    if (country) countries.add(countryKey(country))

    const continent = qso.continent?.toUpperCase() || continentFromCountry(qso.country)
    if (continent) continents.add(continent)
  }

  return { callsigns, grids, bandModeSlots, countries, continents, prefixes, byCallsign }
}

function getDecodeLogStatus(decode: WsjtxDecodeItem, logbook: LogbookIndex): DecodeLogStatus {
  const call = decode.dxCallsign?.toUpperCase()
  if (!call) return 'unknown'
  if (logbook.callsigns.has(call)) return 'worked'

  const grid = decode.dxGrid?.toUpperCase()
  if (grid && !logbook.grids.has(grid)) return 'new-grid'

  return 'new-station'
}

function mergeQsos(current: Qso[], incoming: Qso[]) {
  const byId = new Map(current.map(qso => [qso.id, qso]))
  for (const qso of incoming) byId.set(qso.id, qso)
  return Array.from(byId.values()).sort((a, b) => new Date(b.dateUtc).getTime() - new Date(a.dateUtc).getTime())
}

function logStatusLabel(status: DecodeLogStatus) {
  if (status === 'worked') return 'Kørt'
  if (status === 'new-grid') return 'Ny grid'
  if (status === 'new-station') return 'Ny station'
  return 'Ukendt'
}

function bandModeKey(callsign: string, band: Band | number | string, mode: Mode | number | string) {
  return `${callsign.toUpperCase()}|${Number(band)}|${Number(mode)}`
}

function modeToEnum(displayMode: string): Mode | null {
  const normalized = displayMode.toUpperCase()
  if (normalized === 'SSB') return Mode.SSB
  if (normalized === 'CW') return Mode.CW
  if (normalized === 'FT8') return Mode.FT8
  if (normalized === 'FT4') return Mode.FT4
  if (normalized === 'RTTY') return Mode.RTTY
  if (normalized === 'DMR') return Mode.DMR
  if (normalized === 'FM') return Mode.FM
  if (normalized === 'AM') return Mode.AM
  return null
}

function bandFromFrequency(frequencyMhz: number): Band | null {
  if (frequencyMhz >= 1.8 && frequencyMhz < 2) return Band.M160
  if (frequencyMhz >= 3.5 && frequencyMhz < 4) return Band.M80
  if (frequencyMhz >= 5 && frequencyMhz < 5.5) return Band.M60
  if (frequencyMhz >= 7 && frequencyMhz < 7.3) return Band.M40
  if (frequencyMhz >= 10 && frequencyMhz < 10.2) return Band.M30
  if (frequencyMhz >= 14 && frequencyMhz < 14.35) return Band.M20
  if (frequencyMhz >= 18 && frequencyMhz < 18.2) return Band.M17
  if (frequencyMhz >= 21 && frequencyMhz < 21.45) return Band.M15
  if (frequencyMhz >= 24.8 && frequencyMhz < 25) return Band.M12
  if (frequencyMhz >= 28 && frequencyMhz < 29.7) return Band.M10
  if (frequencyMhz >= 50 && frequencyMhz < 54) return Band.M6
  if (frequencyMhz >= 144 && frequencyMhz < 148) return Band.M2
  if (frequencyMhz >= 430 && frequencyMhz < 450) return Band.CM70
  return null
}

function bandModeLabel(row: DecodeRow) {
  const band = bandFromFrequency(row.frequencyMhz)
  const bandLabel = band ? BandLabels[band] : `${row.frequencyMhz.toFixed(3)} MHz`
  return `${bandLabel} / ${row.displayMode}`
}

function wantedReasonLabels(row: DecodeRow) {
  const labels: string[] = []
  if (row.callsMe) labels.push('Kalder mig')
  if (row.logStatus === 'new-grid') labels.push('Ny grid')
  if (row.logStatus === 'new-station') labels.push('Ny station')
  if (row.isNewBandMode) labels.push('Ny band/mode')
  if (row.logStatus === 'worked' && !row.isNewBandMode) labels.push('Worked B4')
  return labels
}

function getWantedReasons(
  decode: WsjtxDecodeItem,
  logbook: LogbookIndex,
  callsMe: boolean,
  displayMode: string,
): WantedReason[] {
  const reasons: WantedReason[] = []
  const call = decode.dxCallsign?.toUpperCase()
  if (callsMe) reasons.push('calling-me')
  if (!call) return reasons

  const band = bandFromFrequency(decode.frequencyMhz)
  const mode = modeToEnum(displayMode)
  const isWorked = logbook.callsigns.has(call)
  const grid = decode.dxGrid?.toUpperCase()

  if (grid && !logbook.grids.has(grid)) reasons.push('new-grid')
  if (!isWorked) reasons.push('new-station')
  if (band && mode && isWorked && !logbook.bandModeSlots.has(bandModeKey(call, band, mode))) reasons.push('new-band-mode')
  if (isWorked) reasons.push('worked')

  return Array.from(new Set(reasons))
}

function callsignPrefix(callsign: string | null | undefined) {
  const normalized = normalizeCallsignForCountry(callsign ?? null)
  if (!normalized) return ''
  const lastDigit = Math.max(...normalized.split('').map((character, index) => /\d/.test(character) ? index : -1))
  return lastDigit >= 0 ? normalized.slice(0, lastDigit + 1) : normalized.slice(0, Math.min(3, normalized.length))
}

function getAwardReasons(
  decode: WsjtxDecodeItem,
  logbook: LogbookIndex,
  callsMe: boolean,
  displayMode: string,
  country: string,
  continent: string,
  prefix: string,
): AwardReason[] {
  const reasons: AwardReason[] = []
  const call = decode.dxCallsign?.toUpperCase()

  if (callsMe) reasons.push('calling-me')
  if (!call) return reasons

  const normalizedCountry = countryKey(country)
  const grid = decode.dxGrid?.toUpperCase()
  const band = bandFromFrequency(decode.frequencyMhz)
  const mode = modeToEnum(displayMode)
  const isWorked = logbook.callsigns.has(call)

  if (normalizedCountry && !logbook.countries.has(normalizedCountry)) reasons.push('dxcc')
  if (continent && !logbook.continents.has(continent)) reasons.push('continent')
  if (grid && !logbook.grids.has(grid)) reasons.push('grid')
  if (prefix && !logbook.prefixes.has(prefix)) reasons.push('wpx')
  if (band && mode && isWorked && !logbook.bandModeSlots.has(bandModeKey(call, band, mode))) reasons.push('band-mode')
  if (isWorked) reasons.push('worked')

  return Array.from(new Set(reasons))
}

function normalizeCallsignForCountry(callsign: string | null) {
  return callsign
    ?.toUpperCase()
    .replace(/[<>]/g, '')
    .split('/')[0]
    .replace(/[^A-Z0-9]/g, '') ?? ''
}

function normalizeCountry(country: string | null | undefined) {
  const value = country?.trim()
  if (!value || value === '-' || value.toLowerCase() === 'ukendt') return ''
  return value
}

function countryKey(country: string | null | undefined) {
  return normalizeCountry(country).toLowerCase()
}

function countryDisplay(country: string) {
  return country
    .split(/(\s+|\/|-)/)
    .map(part => /^[a-zæøå]/.test(part) ? part.charAt(0).toUpperCase() + part.slice(1) : part)
    .join('')
}

function continentFromCountry(country: string | null | undefined) {
  const key = countryKey(country)
  if (!key) return ''
  return COUNTRY_CONTINENTS[key] ?? ''
}

function countryFromCallsign(callsign: string | null) {
  const normalized = normalizeCallsignForCountry(callsign)
  if (!normalized) return '-'
  return CALLSIGN_COUNTRY_PREFIXES.find(([pattern]) => pattern.test(normalized))?.[1] ?? 'Ukendt'
}

function awardReasonLabels(row: DecodeRow) {
  const labels: Array<{ key: AwardReason; label: string; className: string }> = []
  for (const reason of row.awardReasons) {
    if (reason === 'calling-me') labels.push({ key: reason, label: 'Kalder mig', className: 'border-red-700 bg-red-950 text-red-100' })
    if (reason === 'dxcc') labels.push({ key: reason, label: 'Ny DXCC', className: 'border-amber-700 bg-amber-950 text-amber-100' })
    if (reason === 'continent') labels.push({ key: reason, label: 'Nyt kontinent', className: 'border-pink-700 bg-pink-950 text-pink-100' })
    if (reason === 'grid') labels.push({ key: reason, label: 'Ny grid', className: 'border-sky-700 bg-sky-950 text-sky-100' })
    if (reason === 'wpx') labels.push({ key: reason, label: 'Ny WPX', className: 'border-cyan-700 bg-cyan-950 text-cyan-100' })
    if (reason === 'band-mode') labels.push({ key: reason, label: 'Ny band/mode', className: 'border-violet-700 bg-violet-950 text-violet-100' })
    if (reason === 'worked') labels.push({ key: reason, label: 'Worked B4', className: 'border-green-800 bg-green-950 text-green-100' })
  }
  return labels
}

function awardScore(row: DecodeRow) {
  return (
    (row.awardReasons.includes('calling-me') ? 1000 : 0) +
    (row.awardReasons.includes('dxcc') ? 500 : 0) +
    (row.awardReasons.includes('continent') ? 400 : 0) +
    (row.awardReasons.includes('grid') ? 300 : 0) +
    (row.awardReasons.includes('wpx') ? 200 : 0) +
    (row.awardReasons.includes('band-mode') ? 100 : 0) +
    (row.awardReasons.includes('worked') ? 10 : 0)
  )
}

function buildAwardCountryStatuses(rows: DecodeRow[], logbook: LogbookIndex): AwardCountryStatus[] {
  const byCountry = new Map<string, AwardCountryStatus>()

  for (const country of logbook.countries) {
    const key = countryKey(country)
    if (!key) continue
    byCountry.set(key, {
      country: countryDisplay(country),
      continent: continentFromCountry(country),
      worked: true,
      liveCount: 0,
      liveNeeded: false,
      bestSnr: null,
      latest: null,
    })
  }

  for (const row of rows) {
    const country = normalizeCountry(row.country)
    const key = countryKey(country)
    if (!key) continue

    const existing = byCountry.get(key) ?? {
      country,
      continent: continentFromCountry(country),
      worked: logbook.countries.has(key),
      liveCount: 0,
      liveNeeded: false,
      bestSnr: null,
      latest: null,
    }

    existing.liveCount += 1
    existing.liveNeeded = !existing.worked
    existing.bestSnr = existing.bestSnr === null ? row.snr : Math.max(existing.bestSnr, row.snr)
    if (!existing.latest || new Date(row.decodedAt).getTime() > new Date(existing.latest.decodedAt).getTime()) {
      existing.latest = row
    }

    byCountry.set(key, existing)
  }

  return Array.from(byCountry.values()).sort((a, b) => {
    const score = (item: AwardCountryStatus) =>
      (item.liveNeeded ? 1000 : 0) +
      (!item.worked ? 100 : 0) +
      (item.liveCount > 0 ? 50 : 0)
    return score(b) - score(a) || a.country.localeCompare(b.country)
  })
}

function normalizeDecodeMode(decode: WsjtxDecodeItem) {
  const mode = decode.mode?.toUpperCase()
  if (mode === 'FT8' || mode === '~') return 'FT8'
  if (mode === 'FT4' || mode === '+') return 'FT4'
  return mode || '-'
}

function formatWsjtxStatus(
  status: WsjtxStatus | null,
  isOnSelectedCall: boolean,
  isSendingSelectedCall: boolean,
) {
  if (!status) return 'Ingen status fra WSJT-X endnu'
  if (status.txWatchdog) return 'TX stoppet af WSJT-X watchdog'
  if (isSendingSelectedCall) return 'Sender nu'
  if (isOnSelectedCall && status.txEnabled) return 'Klar til TX'
  if (isOnSelectedCall) return 'Valgt i WSJT-X'
  if (status.dxCall) return `WSJT-X er paa ${status.dxCall}`
  return status.txEnabled ? 'Auto TX er aktiv' : 'Ikke i call mode'
}

function rowMatchesMessageFilter(row: DecodeRow, messageFilter: MessageFilter) {
  const message = row.message.toUpperCase()
  if (messageFilter === 'CQ') return message.startsWith('CQ ') || message.includes(' CQ ')
  if (messageFilter === 'me') return row.callsMe
  if (messageFilter === '73') return message.includes('73')
  return true
}

function decodeCallsMe(message: string, callsign: string | null | undefined) {
  const ownCallsign = callsign?.trim().toUpperCase()
  if (!ownCallsign) return false

  const tokens = message
    .toUpperCase()
    .split(/\s+/)
    .map(token => token.replace(/^[^A-Z0-9/]+|[^A-Z0-9/]+$/g, ''))
    .filter(Boolean)

  return tokens.includes(ownCallsign)
}

function rowMatchesQuickSearch(row: DecodeRow, search: string) {
  if (!search) return true
  const haystack = [
    row.dxCallsign,
    row.dxGrid,
    row.logStatus,
    row.displayMode,
    row.country,
    row.message,
    row.spotterCallsign,
    row.spotterGrid,
  ].join(' ').toUpperCase()
  return haystack.includes(search.toUpperCase())
}

function qsoToEditForm(qso: Qso): QsoEditForm {
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

function qsoFormPayload(form: QsoEditForm) {
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

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? '-')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export default function DecodePage() {
  const { isLoading } = useRequireAuth()
  const gridRef = useRef<AgGridReact<DecodeRow>>(null)
  const [decodes, setDecodes] = useState<WsjtxDecodeItem[]>([])
  const [messageFilter, setMessageFilter] = useState<MessageFilter>('all')
  const [activeView, setActiveView] = useState<DecodeView>('grid')
  const [awardFilters, setAwardFilters] = useState<Record<AwardFilter, boolean>>(DEFAULT_AWARD_FILTERS)
  const [onlyAwardNeeded, setOnlyAwardNeeded] = useState(true)
  const [quickSearch, setQuickSearch] = useState('')
  const [onlyWithGrid, setOnlyWithGrid] = useState(false)
  const [connected, setConnected] = useState(false)
  const [commandStatus, setCommandStatus] = useState<string | null>(null)
  const [pendingCommand, setPendingCommand] = useState(false)
  const [qsos, setQsos] = useState<Qso[]>([])
  const [selectedDecode, setSelectedDecode] = useState<DecodeRow | null>(null)
  const [wsjtxStatus, setWsjtxStatus] = useState<WsjtxStatus | null>(null)
  const [txCountByCall, setTxCountByCall] = useState<Record<string, number>>({})
  const [qsoForm, setQsoForm] = useState<QsoEditForm>(EMPTY_QSO_FORM)
  const [qsoFormQsoId, setQsoFormQsoId] = useState<number | null>(null)
  const [qsoSaving, setQsoSaving] = useState(false)
  const [qsoSaveStatus, setQsoSaveStatus] = useState<string | null>(null)
  const lastTxRef = useRef({ call: '', transmitting: false })
  const { isAuthenticated, user } = useAuth()
  const ownCallsign = user?.callsign?.toUpperCase() ?? ''

  useEffect(() => {
    if (isAuthenticated) {
      api.qsos.getMine().then(setQsos).catch(() => {})
    }
  }, [isAuthenticated])

  const logbook = useMemo(() => qsos.length ? buildLogbookIndex(qsos) : EMPTY_LOGBOOK_INDEX, [qsos])

  useEffect(() => {
    if (!isAuthenticated) return
    api.wsjtx.getRecentDecodes(MAX_ROWS)
      .then(items => setDecodes(items))
      .catch(() => {})

    const es = new EventSource(`${API_URL}/api/wsjtx/stream`)
    es.onopen = () => setConnected(true)
    es.onmessage = (e) => {
      setConnected(true)
      const decode: WsjtxDecodeItem = JSON.parse(e.data)
      setDecodes(prev => {
        const next = [decode, ...prev]
        return next.length > MAX_ROWS ? next.slice(0, MAX_ROWS) : next
      })
    }
    es.onerror = () => setConnected(false)
    return () => es.close()
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return

    let cancelled = false
    const refreshStatus = async () => {
      try {
        const status = await api.wsjtx.getStatus()
        if (!cancelled) setWsjtxStatus(status)
      } catch {
        if (!cancelled) setWsjtxStatus(null)
      }
    }

    refreshStatus()
    const timer = window.setInterval(refreshStatus, 1000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [isAuthenticated])

  const rows = useMemo<DecodeRow[]>(() => {
    return decodes
      .map(d => {
        const callsMe = decodeCallsMe(d.message, ownCallsign)
        const displayMode = normalizeDecodeMode(d)
        const wantedReasons = getWantedReasons(d, logbook, callsMe, displayMode)
        const country = normalizeCountry(d.dxCountry) || countryFromCallsign(d.dxCallsign)
        const continent = d.dxContinent || continentFromCountry(country)
        const prefix = d.dxWpxPrefix || callsignPrefix(d.dxCallsign)
        const awardReasons = getAwardReasons(d, logbook, callsMe, displayMode, country, continent, prefix)
        return {
          ...d,
          distanceKm: distanceKm(d.spotterGrid, d.dxGrid),
          logStatus: getDecodeLogStatus(d, logbook),
          displayMode,
          country,
          continent,
          prefix,
          callsMe,
          canRespond: d.isCallable || callsMe,
          isNewBandMode: wantedReasons.includes('new-band-mode'),
          wantedReasons,
          awardReasons,
        }
      })
      .filter(row => rowMatchesMessageFilter(row, messageFilter))
      .filter(row => !onlyWithGrid || Boolean(row.dxGrid))
      .filter(row => rowMatchesQuickSearch(row, quickSearch))
  }, [decodes, logbook, messageFilter, onlyWithGrid, ownCallsign, quickSearch])

  const mapRows = useMemo(() => rows.filter(row => Boolean(gridToLatLng(row.dxGrid))), [rows])
  const wantedRows = useMemo(() => rows
    .filter(row => row.callsMe || row.logStatus === 'new-grid' || row.logStatus === 'new-station' || row.isNewBandMode || row.logStatus === 'worked')
    .sort((a, b) => {
      const score = (row: DecodeRow) =>
        (row.callsMe ? 1000 : 0) +
        (row.logStatus === 'new-grid' ? 300 : 0) +
        (row.logStatus === 'new-station' ? 200 : 0) +
        (row.isNewBandMode ? 100 : 0) +
        (row.logStatus === 'worked' ? 10 : 0)
      return score(b) - score(a) || new Date(b.decodedAt).getTime() - new Date(a.decodedAt).getTime()
    }), [rows])
  const wantedStats = useMemo(() => ({
    callsMe: rows.filter(row => row.callsMe).length,
    newGrid: rows.filter(row => row.logStatus === 'new-grid').length,
    newStation: rows.filter(row => row.logStatus === 'new-station').length,
    newBandMode: rows.filter(row => row.isNewBandMode).length,
    worked: rows.filter(row => row.logStatus === 'worked' && !row.isNewBandMode).length,
  }), [rows])
  const awardCountries = useMemo(() => buildAwardCountryStatuses(rows, logbook), [rows, logbook])
  const awardContinents = useMemo(() => CONTINENTS.map(code => {
    const liveRows = rows.filter(row => row.continent === code)
    const worked = logbook.continents.has(code)
    return {
      code,
      label: CONTINENT_LABELS[code],
      worked,
      liveCount: liveRows.length,
      liveNeeded: liveRows.length > 0 && !worked,
      countriesWorked: awardCountries.filter(country => country.continent === code && country.worked).length,
      countriesLiveNeeded: awardCountries.filter(country => country.continent === code && country.liveNeeded).length,
    }
  }), [awardCountries, logbook, rows])
  const awardSummary = useMemo(() => ({
    workedContinents: awardContinents.filter(item => item.worked).length,
    liveNeededContinents: awardContinents.filter(item => item.liveNeeded).length,
    workedCountries: awardCountries.filter(item => item.worked).length,
    liveNeededCountries: awardCountries.filter(item => item.liveNeeded).length,
  }), [awardContinents, awardCountries])

  const awardHitRows = useMemo(() => {
    const activeReasons = Object.entries(awardFilters)
      .filter(([, enabled]) => enabled)
      .map(([reason]) => reason as AwardReason)

    return rows
      .filter(row => activeReasons.some(reason => row.awardReasons.includes(reason)))
      .sort((a, b) => awardScore(b) - awardScore(a) || new Date(b.decodedAt).getTime() - new Date(a.decodedAt).getTime())
  }, [awardFilters, rows])

  const mapMarkers = useMemo<DecodeMapMarker[]>(() => {
    return mapRows.map(row => {
      const position = gridToLatLng(row.dxGrid)!
      const distance = row.distanceKm ? `${row.distanceKm.toLocaleString('da-DK')} km` : '-'
      return {
        id: String(row.id),
        decodeId: row.id,
        lat: position.lat,
        lng: position.lng,
        label: row.dxCallsign ?? row.dxGrid ?? row.message,
        variant: row.callsMe ? 'calling-me' : row.logStatus,
        actionLabel: row.canRespond ? 'Svar' : 'Se decode',
        tooltip: [
          row.dxCallsign ?? row.message,
          row.dxGrid ? `Grid ${row.dxGrid}` : null,
          row.country !== '-' ? row.country : null,
          row.distanceKm ? `${row.distanceKm.toLocaleString('da-DK')} km` : null,
          `SNR ${snrText(row.snr)}`,
        ].filter(Boolean).join(' · '),
        popup: [
          `<b>${escapeHtml(row.dxCallsign ?? row.message)}</b>`,
          `<br/>Grid: <span style="font-family: monospace">${escapeHtml(row.dxGrid)}</span>`,
          `<br/>Land: ${escapeHtml(row.country)}`,
          `<br/>Status: ${escapeHtml(logStatusLabel(row.logStatus))}`,
          row.callsMe ? `<br/><b>Kalder ${escapeHtml(ownCallsign)}</b>` : null,
          `<br/>SNR: <span style="font-family: monospace">${escapeHtml(snrText(row.snr))}</span>`,
          `<br/>Afstand: ${escapeHtml(distance)}`,
          `<br/>Mode: ${escapeHtml(row.displayMode)}`,
          `<br/><span style="font-family: monospace">${escapeHtml(row.message)}</span>`,
        ].filter(Boolean).join(''),
      }
    })
  }, [mapRows, ownCallsign])

  const selectedTrail = useMemo(() => {
    if (!selectedDecode) return []
    return decodes.filter(d => isRelatedMessage(d, selectedDecode)).slice(0, 30)
  }, [decodes, selectedDecode])

  const selectedLoggedQso = useMemo(() => {
    const call = selectedDecode?.dxCallsign?.toUpperCase()
    return call ? logbook.byCallsign.get(call) ?? null : null
  }, [logbook, selectedDecode])

  const selectedCall = selectedDecode?.dxCallsign?.toUpperCase() ?? ''
  const wsjtxStatusCall = wsjtxStatus?.dxCall?.toUpperCase() ?? ''
  const wsjtxIsOnSelectedCall = Boolean(selectedCall && wsjtxStatusCall === selectedCall)
  const wsjtxIsSendingSelectedCall = Boolean(wsjtxIsOnSelectedCall && wsjtxStatus?.transmitting)
  const selectedTxCount = selectedCall ? txCountByCall[selectedCall] ?? 0 : 0

  useEffect(() => {
    if (!selectedLoggedQso) {
      setQsoForm(EMPTY_QSO_FORM)
      setQsoFormQsoId(null)
      setQsoSaveStatus(null)
      return
    }
    if (qsoFormQsoId === selectedLoggedQso.id) return
    setQsoForm(qsoToEditForm(selectedLoggedQso))
    setQsoFormQsoId(selectedLoggedQso.id)
    setQsoSaveStatus('QSO modtaget fra WSJT-X. Gennemse og gem eventuelle rettelser.')
  }, [qsoFormQsoId, selectedLoggedQso])

  useEffect(() => {
    if (!selectedCall) return

    const transmitting = wsjtxIsSendingSelectedCall
    const previous = lastTxRef.current
    if (transmitting && (previous.call !== selectedCall || !previous.transmitting)) {
      setTxCountByCall(current => ({
        ...current,
        [selectedCall]: (current[selectedCall] ?? 0) + 1,
      }))
    }
    lastTxRef.current = { call: selectedCall, transmitting }
  }, [selectedCall, wsjtxIsSendingSelectedCall])

  useEffect(() => {
    const call = selectedDecode?.dxCallsign?.toUpperCase()
    if (!call || selectedLoggedQso) return

    let cancelled = false
    const refreshSelectedQso = async () => {
      try {
        const matches = await api.qsos.getMine(call)
        if (!cancelled) setQsos(current => mergeQsos(current, matches))
      } catch {
        // Live decode should keep running even if the logbook refresh misses once.
      }
    }

    refreshSelectedQso()
    const timer = window.setInterval(refreshSelectedQso, 5000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [selectedDecode, selectedLoggedQso])

  const columnDefs = useMemo<ColDef<DecodeRow>[]>(() => [
    {
      headerName: 'Tid',
      field: 'decodedAt',
      width: 105,
      valueFormatter: p => p.value ? formatTime(p.value) : '',
      sort: 'desc',
      filter: 'agDateColumnFilter',
    },
    {
      headerName: 'Kaldesignal',
      field: 'dxCallsign',
      width: 150,
      filter: 'agTextColumnFilter',
      cellRenderer: ({ data, value }: { data?: DecodeRow; value?: string }) => (
        <span className="font-mono font-semibold text-inherit">
          {value ?? '-'}
          {data?.callsMe && <span className="ml-2 rounded border border-red-700 bg-red-950 px-1.5 py-0.5 text-[11px] text-red-100">Mig</span>}
          {data?.isCallable && <span className="ml-2 rounded border border-blue-700 bg-blue-950 px-1.5 py-0.5 text-[11px] text-blue-100">Call</span>}
        </span>
      ),
    },
    {
      headerName: 'Status',
      field: 'logStatus',
      width: 120,
      filter: 'agTextColumnFilter',
      cellRenderer: ({ value }: { value?: DecodeLogStatus }) => (
        <span className={`hamhub-log-pill hamhub-log-pill-${value ?? 'unknown'}`}>
          {logStatusLabel(value ?? 'unknown')}
        </span>
      ),
    },
    { headerName: 'Grid', field: 'dxGrid', width: 95, filter: 'agTextColumnFilter', valueFormatter: p => p.value ?? '-' },
    {
      headerName: 'Afstand',
      field: 'distanceKm',
      width: 115,
      filter: 'agNumberColumnFilter',
      valueFormatter: p => typeof p.value === 'number' ? `${p.value.toLocaleString('da-DK')} km` : '-',
    },
    {
      headerName: 'SNR',
      field: 'snr',
      width: 85,
      filter: 'agNumberColumnFilter',
      valueFormatter: p => typeof p.value === 'number' ? snrText(p.value) : '',
      cellClass: p => p.value >= 0 ? 'hamhub-snr-good' : p.value >= -10 ? 'hamhub-snr-fair' : 'hamhub-snr-weak',
    },
    {
      headerName: 'Freq',
      field: 'frequencyMhz',
      width: 105,
      filter: 'agNumberColumnFilter',
      valueFormatter: p => typeof p.value === 'number' ? p.value.toFixed(3) : '',
    },
    { headerName: 'Mode', field: 'displayMode', width: 85, filter: 'agTextColumnFilter' },
    { headerName: 'Besked', field: 'message', flex: 1, minWidth: 220, filter: 'agTextColumnFilter' },
    { headerName: 'Land', field: 'country', width: 130, filter: 'agTextColumnFilter' },
  ], [])

  const defaultColDef = useMemo<ColDef<DecodeRow>>(() => ({
    sortable: true,
    filter: true,
    floatingFilter: true,
    resizable: true,
  }), [])

  const rowClassRules = useMemo<RowClassRules<DecodeRow>>(() => ({
    'hamhub-row-worked': params => params.data?.logStatus === 'worked',
    'hamhub-row-new-grid': params => params.data?.logStatus === 'new-grid',
    'hamhub-row-new-station': params => params.data?.logStatus === 'new-station',
    'hamhub-callable-row': params => Boolean(params.data?.canRespond),
    'hamhub-calling-me-row': params => Boolean(params.data?.callsMe),
  }), [])

  const handleGridRowClick = (event: RowClickedEvent<DecodeRow>) => {
    if (event.data?.canRespond) {
      setSelectedDecode(event.data)
      setCommandStatus(null)
    }
  }

  const handleMapMarkerClick = useCallback((marker: MapMarker) => {
    const decodeMarker = marker as DecodeMapMarker
    const row = rows.find(item => item.id === decodeMarker.decodeId)
    if (row) {
      setSelectedDecode(row)
      setCommandStatus(null)
    }
  }, [rows])

  const handleCallDecode = async (decode: DecodeRow) => {
    if (!decode.canRespond || pendingCommand) return
    try {
      setPendingCommand(true)
      const call = decode.dxCallsign?.toUpperCase()
      if (call) {
        setTxCountByCall(current => ({ ...current, [call]: 0 }))
        lastTxRef.current = { call, transmitting: false }
      }
      setCommandStatus(`${decode.callsMe ? 'Svarer' : 'Kalder'} ${decode.dxCallsign ?? decode.message}...`)
      await api.wsjtx.callDecode(decode)
      setCommandStatus(`Reply sendt til WSJT-X: ${decode.dxCallsign ?? decode.message}`)
    } catch (err) {
      setCommandStatus(err instanceof Error ? err.message : 'Kunne ikke sende kald til WSJT-X')
    } finally {
      setPendingCommand(false)
    }
  }

  const handleStopTx = async () => {
    if (pendingCommand) return
    try {
      setPendingCommand(true)
      setCommandStatus('Stopper kald i WSJT-X...')
      await api.wsjtx.stopTx()
      setCommandStatus('Stop Tx sendt til WSJT-X')
    } catch (err) {
      setCommandStatus(err instanceof Error ? err.message : 'Kunne ikke stoppe kald')
    } finally {
      setPendingCommand(false)
    }
  }

  const setQsoField = (key: keyof QsoEditForm) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setQsoForm(current => ({ ...current, [key]: event.target.value }))
  }

  const handleSaveLoggedQso = async (event: FormEvent) => {
    event.preventDefault()
    if (!selectedLoggedQso || qsoSaving) return
    try {
      setQsoSaving(true)
      setQsoSaveStatus('Gemmer QSO...')
      const updated = await api.qsos.update(selectedLoggedQso.id, qsoFormPayload(qsoForm))
      setQsos(current => mergeQsos(current, [updated]))
      setQsoSaveStatus('QSO gemt i HamHub.')
    } catch (err) {
      setQsoSaveStatus(err instanceof Error ? err.message : 'Kunne ikke gemme QSO')
    } finally {
      setQsoSaving(false)
    }
  }

  const clearGridFilters = () => {
    setMessageFilter('all')
    setQuickSearch('')
    setOnlyWithGrid(false)
    gridRef.current?.api.setFilterModel(null)
  }

  if (isLoading || !isAuthenticated) return null

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Live Decodes</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={handleStopTx}
            disabled={pendingCommand}
            className="border border-red-800 bg-red-950 px-3 py-2 text-sm font-medium text-red-100 transition-colors hover:bg-red-900 disabled:border-gray-700 disabled:bg-gray-800 disabled:text-gray-500"
          >
            Stop kald
          </button>
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <span className={`inline-block h-2 w-2 rounded-full ${connected ? 'animate-pulse bg-green-500' : 'bg-red-500'}`} />
            {connected ? 'SSE live' : 'Genopretter...'}
          </span>
          <Badge variant="info">{rows.length}/{decodes.length} decodes</Badge>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="flex gap-1 border-b border-gray-700">
          {(['all', 'CQ', 'me', '73'] as const).map(f => (
            <button
              key={f}
              onClick={() => setMessageFilter(f)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${messageFilter === f ? 'border-cyan-500 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
            >
              {f === 'all' ? 'Alle beskeder' : f === 'me' ? `Kalder ${ownCallsign || 'mig'}` : f}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={onlyWithGrid}
            onChange={event => setOnlyWithGrid(event.target.checked)}
            className="h-4 w-4 accent-blue-500"
          />
          Kun med grid
        </label>
        <input
          value={quickSearch}
          onChange={event => setQuickSearch(event.target.value)}
          placeholder="Soeg i grid..."
          className="w-full max-w-xs border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 md:w-64"
        />
        <button
          onClick={clearGridFilters}
          className="border border-gray-700 px-3 py-2 text-sm font-medium text-gray-300 hover:border-gray-500 hover:text-white"
        >
          Ryd filtre
        </button>
      </div>

      <div className="mb-4 flex border-b border-gray-800">
        {([
          ['grid', 'Grid'],
          ['map', 'Kort'],
          ['wanted', 'Wanted'],
          ['awards', 'Awards'],
        ] as const).map(([view, label]) => (
          <button
            key={view}
            onClick={() => setActiveView(view)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${activeView === view ? 'border-blue-500 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {commandStatus && (
        <div className="mb-4 border border-gray-800 bg-gray-900/60 px-3 py-2 text-sm text-gray-300">
          {commandStatus}
        </div>
      )}

      {activeView === 'grid' ? (
        <Card>
          <CardContent className="p-0">
            <div className="ag-theme-quartz-dark hamhub-decode-grid h-[70vh] w-full">
              <AgGridReact<DecodeRow>
                ref={gridRef}
                rowData={rows}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                animateRows
                rowHeight={38}
                headerHeight={42}
                floatingFiltersHeight={36}
                onRowClicked={handleGridRowClick}
                rowClassRules={rowClassRules}
              />
            </div>
          </CardContent>
        </Card>
      ) : activeView === 'map' ? (
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-400">
              <span>
                Viser <span className="font-semibold text-white">{mapMarkers.length}</span> decodes med gyldigt grid
              </span>
              <span>
                {rows.length - mapMarkers.length > 0 ? `${rows.length - mapMarkers.length} decodes mangler grid` : 'Alle filtrerede decodes har grid'}
              </span>
            </div>
            {mapMarkers.length > 0 ? (
              <LeafletMap markers={mapMarkers} height="70vh" onMarkerAction={handleMapMarkerClick} />
            ) : (
              <div className="flex h-[70vh] items-center justify-center border border-gray-800 bg-gray-950 text-sm text-gray-500">
                Ingen filtrerede decodes med gyldigt grid endnu.
              </div>
            )}
          </CardContent>
        </Card>
      ) : activeView === 'wanted' ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-5">
            <WantedStat label="Kalder mig" value={wantedStats.callsMe} className="border-red-800 bg-red-950/40 text-red-100" />
            <WantedStat label="Nye grids" value={wantedStats.newGrid} className="border-amber-700 bg-amber-950/30 text-amber-100" />
            <WantedStat label="Nye stationer" value={wantedStats.newStation} className="border-sky-700 bg-sky-950/30 text-sky-100" />
            <WantedStat label="Ny band/mode" value={wantedStats.newBandMode} className="border-violet-700 bg-violet-950/30 text-violet-100" />
            <WantedStat label="Worked B4" value={wantedStats.worked} className="border-green-800 bg-green-950/30 text-green-100" />
          </div>

          <Card>
            <CardContent className="p-0">
              {wantedRows.length > 0 ? (
                <div className="divide-y divide-gray-800">
                  {wantedRows.slice(0, 80).map(row => (
                    <button
                      key={`${row.id}-${row.decodedAt}`}
                      type="button"
                      onClick={() => {
                        if (row.canRespond) {
                          setSelectedDecode(row)
                          setCommandStatus(null)
                        }
                      }}
                      className="grid w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-800/50 md:grid-cols-[92px_130px_160px_1fr_130px]"
                    >
                      <div className="font-mono text-xs text-gray-500">{formatTime(row.decodedAt)}</div>
                      <div>
                        <div className="font-mono text-sm font-bold text-white">{row.dxCallsign ?? '-'}</div>
                        <div className="text-xs text-gray-500">{row.country}</div>
                      </div>
                      <div className="text-sm text-gray-300">
                        <div className="font-mono">{row.dxGrid ?? '-'}</div>
                        <div className="text-xs text-gray-500">{bandModeLabel(row)}</div>
                      </div>
                      <div>
                        <div className="flex flex-wrap gap-1">
                          {wantedReasonLabels(row).map(label => (
                            <span key={label} className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${label === 'Kalder mig' ? 'border-red-700 bg-red-950 text-red-100' : label === 'Ny grid' ? 'border-amber-700 bg-amber-950 text-amber-100' : label === 'Ny station' ? 'border-sky-700 bg-sky-950 text-sky-100' : label === 'Ny band/mode' ? 'border-violet-700 bg-violet-950 text-violet-100' : 'border-green-800 bg-green-950 text-green-100'}`}>
                              {label}
                            </span>
                          ))}
                        </div>
                        <div className="mt-1 font-mono text-xs text-gray-400">{row.message}</div>
                      </div>
                      <div className="text-right text-sm text-gray-400">
                        <div className="font-mono">{snrText(row.snr)} dB</div>
                        <div className="text-xs">{row.distanceKm ? `${row.distanceKm.toLocaleString('da-DK')} km` : '-'}</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex h-[50vh] items-center justify-center text-sm text-gray-500">
                  Ingen wanted/live status endnu med de aktuelle filtre.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-5">
            <WantedStat label="Live award hits" value={awardHitRows.length} className="border-cyan-800 bg-cyan-950/30 text-cyan-100" />
            <WantedStat label="Kontinenter kørt" value={awardSummary.workedContinents} className="border-green-800 bg-green-950/30 text-green-100" />
            <WantedStat label="Kontinenter live needed" value={awardSummary.liveNeededContinents} className="border-red-800 bg-red-950/40 text-red-100" />
            <WantedStat label="Lande kørt" value={awardSummary.workedCountries} className="border-sky-800 bg-sky-950/30 text-sky-100" />
            <WantedStat label="Lande live needed" value={awardSummary.liveNeededCountries} className="border-amber-700 bg-amber-950/30 text-amber-100" />
          </div>

          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                {([
                  ['dxcc', 'DXCC'],
                  ['continent', 'Kontinent'],
                  ['grid', 'Grid'],
                  ['wpx', 'WPX'],
                  ['band-mode', 'Band/mode'],
                ] as const).map(([filter, label]) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setAwardFilters(current => ({ ...current, [filter]: !current[filter] }))}
                    className={`border px-3 py-2 text-sm font-semibold transition-colors ${awardFilters[filter] ? 'border-cyan-600 bg-cyan-950/60 text-cyan-100' : 'border-gray-800 bg-gray-950 text-gray-500 hover:border-gray-600 hover:text-gray-300'}`}
                  >
                    {label}
                  </button>
                ))}
                <label className="ml-auto flex items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={onlyAwardNeeded}
                    onChange={event => setOnlyAwardNeeded(event.target.checked)}
                    className="h-4 w-4 accent-cyan-500"
                  />
                  Kun needed
                </label>
              </div>

              <div className="overflow-x-auto border border-gray-800 bg-black/20">
                <div className="min-w-[920px]">
                  <div className="grid grid-cols-[88px_120px_1.2fr_130px_120px_90px_1fr] gap-3 border-b border-gray-800 bg-gray-900/60 px-4 py-3 text-xs font-semibold uppercase text-gray-500">
                    <span>Tid</span>
                    <span>Call</span>
                    <span>Årsag</span>
                    <span>Land</span>
                    <span>Zone</span>
                    <span>SNR</span>
                    <span>Besked</span>
                  </div>
                  <div className="max-h-[42vh] divide-y divide-gray-800 overflow-auto">
                    {awardHitRows.length > 0 ? awardHitRows.slice(0, 120).map(row => (
                      <button
                        key={`award-${row.id}-${row.decodedAt}`}
                        type="button"
                        onClick={() => {
                          if (row.canRespond) {
                            setSelectedDecode(row)
                            setCommandStatus(null)
                          }
                        }}
                        className="grid w-full grid-cols-[88px_120px_1.2fr_130px_120px_90px_1fr] gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-gray-800/50"
                      >
                        <span className="font-mono text-xs text-gray-500">{formatTime(row.decodedAt)}</span>
                        <span>
                          <span className="block font-mono font-bold text-white">{row.dxCallsign ?? '-'}</span>
                          <span className="font-mono text-xs text-gray-500">{row.dxGrid ?? row.prefix ?? '-'}</span>
                        </span>
                        <span className="flex flex-wrap gap-1">
                          {awardReasonLabels(row)
                            .filter(label => label.key !== 'worked' || !onlyAwardNeeded)
                            .map(label => (
                              <span key={label.key} className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${label.className}`}>
                                {label.label}
                              </span>
                            ))}
                        </span>
                        <span>
                          <span className="block font-semibold text-white">{row.country}</span>
                          <span className="font-mono text-xs text-gray-500">{row.continent || '-'}</span>
                        </span>
                        <span className="font-mono text-xs text-gray-400">
                          CQ {row.dxCqZone ?? '-'} / ITU {row.dxItuZone ?? '-'}
                        </span>
                        <span className="font-mono text-gray-300">{snrText(row.snr)} dB</span>
                        <span className="truncate font-mono text-xs text-gray-400">{row.message}</span>
                      </button>
                    )) : (
                      <div className="px-4 py-8 text-center text-sm text-gray-500">
                        Ingen live award hits med de valgte filtre.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 md:grid-cols-7">
            {awardContinents.map(item => (
              <div
                key={item.code}
                className={`border px-3 py-3 ${item.liveNeeded ? 'border-red-800 bg-red-950/40' : item.worked ? 'border-green-800 bg-green-950/30' : item.liveCount > 0 ? 'border-amber-700 bg-amber-950/30' : 'border-gray-800 bg-gray-900/50'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-mono text-lg font-bold text-white">{item.code}</p>
                    <p className="text-xs text-gray-400">{item.label}</p>
                  </div>
                  <span className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${item.liveNeeded ? 'border-red-700 text-red-100' : item.worked ? 'border-green-700 text-green-100' : 'border-gray-700 text-gray-300'}`}>
                    {item.liveNeeded ? 'Needed' : item.worked ? 'Kørt' : 'Mangler'}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-400">
                  <div>
                    <p className="uppercase text-gray-500">Live</p>
                    <p className="font-mono text-sm text-white">{item.liveCount}</p>
                  </div>
                  <div>
                    <p className="uppercase text-gray-500">Lande</p>
                    <p className="font-mono text-sm text-white">{item.countriesWorked}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <div className="min-w-[760px]">
                  <div className="grid grid-cols-[1fr_90px_110px_90px_1fr] gap-3 border-b border-gray-800 bg-gray-900/60 px-4 py-3 text-xs font-semibold uppercase text-gray-500">
                    <span>Land / DXCC</span>
                    <span>Kontinent</span>
                    <span>Status</span>
                    <span>Live</span>
                    <span>Bedste live decode</span>
                  </div>
                  <div className="divide-y divide-gray-800">
                    {awardCountries.slice(0, 120).map(item => (
                      <button
                        key={item.country}
                        type="button"
                        onClick={() => {
                          if (item.latest?.canRespond) {
                            setSelectedDecode(item.latest)
                            setCommandStatus(null)
                          }
                        }}
                        className="grid w-full grid-cols-[1fr_90px_110px_90px_1fr] gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-gray-800/50"
                      >
                        <span className="font-semibold text-white">{item.country}</span>
                        <span className="font-mono text-gray-300">{item.continent || '-'}</span>
                        <span>
                          <span className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${item.liveNeeded ? 'border-red-700 bg-red-950 text-red-100' : item.worked ? 'border-green-800 bg-green-950 text-green-100' : 'border-gray-700 text-gray-300'}`}>
                            {item.liveNeeded ? 'Live needed' : item.worked ? 'Kørt' : 'Mangler'}
                          </span>
                        </span>
                        <span className="font-mono text-gray-300">{item.liveCount}</span>
                        <span className="truncate font-mono text-xs text-gray-400">
                          {item.latest ? `${item.latest.dxCallsign ?? '-'} ${snrText(item.latest.snr)}dB ${bandModeLabel(item.latest)}` : '-'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedDecode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="max-h-[88vh] w-full max-w-4xl overflow-auto border border-gray-700 bg-gray-950 shadow-2xl">
            <div className="flex items-start justify-between border-b border-gray-800 px-5 py-4">
              <div>
                <p className="text-xs uppercase text-gray-500">QSO kandidat</p>
                <h2 className="mt-1 font-mono text-2xl font-bold text-white">{selectedDecode.dxCallsign}</h2>
                <p className="mt-1 font-mono text-sm text-gray-400">{selectedDecode.message}</p>
              </div>
              <button
                onClick={() => setSelectedDecode(null)}
                className="px-2 py-1 text-xl text-gray-400 hover:text-white"
                aria-label="Luk"
              >
                x
              </button>
            </div>

            <div className="grid gap-4 px-5 py-4 md:grid-cols-4">
              <Info label="Grid" value={selectedDecode.dxGrid ?? '-'} />
              <Info label="Afstand" value={selectedDecode.distanceKm ? `${selectedDecode.distanceKm.toLocaleString('da-DK')} km` : '-'} />
              <Info label="SNR" value={snrText(selectedDecode.snr)} />
              <Info label="Frekvens" value={`${selectedDecode.frequencyMhz.toFixed(3)} MHz`} />
            </div>

            <div className="border-y border-gray-800 bg-gray-900/40 px-5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1 text-sm text-gray-400">
                  <div>
                    <span className="text-gray-500">Din station:</span>{' '}
                    <span className="font-mono text-gray-200">{selectedDecode.spotterCallsign}</span>
                    {selectedDecode.spotterGrid && <span className="font-mono text-gray-500"> / {selectedDecode.spotterGrid}</span>}
                  </div>
                  <div>
                    <span className="text-gray-500">HamHub log:</span>{' '}
                    {selectedLoggedQso ? (
                      <span className="text-green-300">
                        Logget {formatTime(selectedLoggedQso.dateUtc)}
                      </span>
                    ) : (
                      <span className="text-amber-300">Venter på WSJT-X QSO Logged...</span>
                    )}
                  </div>
                  <div>
                    <span className="text-gray-500">WSJT-X:</span>{' '}
                    <span className={wsjtxIsSendingSelectedCall ? 'font-semibold text-green-300' : wsjtxStatus?.txWatchdog ? 'font-semibold text-red-300' : 'text-gray-200'}>
                      {formatWsjtxStatus(wsjtxStatus, wsjtxIsOnSelectedCall, wsjtxIsSendingSelectedCall)}
                    </span>
                    {wsjtxStatus && (
                      <span className="font-mono text-gray-500">
                        {' '}TX {wsjtxStatus.txEnabled ? 'on' : 'off'} / DF {wsjtxStatus.txDf || '-'}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-gray-500">Kald:</span>{' '}
                    <span className="font-mono text-gray-200">{selectedTxCount}</span>
                    <span className="text-gray-500"> TX-perioder</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCallDecode(selectedDecode)}
                    disabled={pendingCommand || !selectedDecode.canRespond}
                    className="bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-400"
                  >
                    {selectedDecode.callsMe ? 'Svar i WSJT-X' : 'Kald station'}
                  </button>
                  <button
                    onClick={handleStopTx}
                    disabled={pendingCommand}
                    className="border border-red-800 bg-red-950 px-4 py-2 text-sm font-semibold text-red-100 hover:bg-red-900 disabled:border-gray-700 disabled:bg-gray-800 disabled:text-gray-500"
                  >
                    Stop kald
                  </button>
                </div>
              </div>
              {commandStatus && <p className="mt-3 text-sm text-gray-300">{commandStatus}</p>}
            </div>

            <div className="px-5 py-4">
              <h3 className="mb-3 text-sm font-semibold text-white">Kommunikation</h3>
              <div className="max-h-64 overflow-auto border border-gray-800 bg-black/30">
                {selectedTrail.length > 0 ? selectedTrail.map(item => (
                  <div key={`${item.id}-${item.decodedAt}`} className="grid grid-cols-[72px_54px_1fr] gap-3 border-b border-gray-900 px-3 py-2 text-sm last:border-b-0">
                    <span className="font-mono text-xs text-gray-500">{formatTime(item.decodedAt)}</span>
                    <span className="font-mono text-xs text-gray-400">{snrText(item.snr)}</span>
                    <span className="font-mono text-gray-200">{item.message}</span>
                  </div>
                )) : (
                  <p className="px-3 py-6 text-center text-sm text-gray-500">
                    Ingen relaterede decodes endnu.
                  </p>
                )}
              </div>
            </div>

            {selectedLoggedQso && (
              <form onSubmit={handleSaveLoggedQso} className="border-t border-gray-800 px-5 py-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Logget QSO</h3>
                    <p className="mt-1 text-sm text-gray-400">
                      QSO #{selectedLoggedQso.id} er logget fra WSJT-X. Ret felterne og gem i HamHub.
                    </p>
                  </div>
                  <Button type="button" variant="secondary" onClick={() => window.open(`/logbook/${selectedLoggedQso.id}`, '_blank')}>
                    Åbn fuld QSO
                  </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <Input label="Dato/tid UTC" type="datetime-local" value={qsoForm.dateUtc} onChange={setQsoField('dateUtc')} required />
                  <Input label="Eget kaldesignal" value={qsoForm.ownCallsign} onChange={setQsoField('ownCallsign')} required />
                  <Input label="Kontaktens kaldesignal" value={qsoForm.workedCallsign} onChange={setQsoField('workedCallsign')} required />
                  <Input label="Frekvens (MHz)" type="number" step="0.001" value={qsoForm.frequency} onChange={setQsoField('frequency')} />
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-300">Band</label>
                    <select value={qsoForm.band} onChange={setQsoField('band')} className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white">
                      {Object.entries(BandLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-300">Mode</label>
                    <select value={qsoForm.mode} onChange={setQsoField('mode')} className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white">
                      {Object.entries(ModeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </div>
                  <Input label="RST sendt" value={qsoForm.rstSent} onChange={setQsoField('rstSent')} />
                  <Input label="RST modtaget" value={qsoForm.rstReceived} onChange={setQsoField('rstReceived')} />
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <Input label="Kontaktens grid" value={qsoForm.locator} onChange={setQsoField('locator')} />
                  <Input label="Mit grid" value={qsoForm.myGridsquare} onChange={setQsoField('myGridsquare')} />
                  <Input label="Land" value={qsoForm.country} onChange={setQsoField('country')} />
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <Input label="Navn" value={qsoForm.name} onChange={setQsoField('name')} />
                  <Input label="QTH" value={qsoForm.qth} onChange={setQsoField('qth')} />
                  <Input label="TX effekt (W)" type="number" step="0.1" value={qsoForm.txPower} onChange={setQsoField('txPower')} />
                </div>

                <div className="mt-3 flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-300">Kommentar</label>
                  <textarea
                    rows={2}
                    value={qsoForm.comment}
                    onChange={setQsoField('comment')}
                    className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white"
                  />
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  {qsoSaveStatus && <p className="text-sm text-gray-300">{qsoSaveStatus}</p>}
                  <Button type="submit" disabled={qsoSaving}>{qsoSaving ? 'Gemmer...' : 'Gem QSO'}</Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase text-gray-500">{label}</p>
      <p className="mt-1 font-mono text-sm font-semibold text-white">{value}</p>
    </div>
  )
}

function WantedStat({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className={`border px-4 py-3 ${className}`}>
      <p className="text-xs uppercase text-current opacity-75">{label}</p>
      <p className="mt-1 font-mono text-2xl font-bold">{value}</p>
    </div>
  )
}
