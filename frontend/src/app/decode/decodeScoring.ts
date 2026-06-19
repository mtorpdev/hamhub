import { distanceKm, gridToLatLng } from '@/lib/maidenhead'
import { type Band, type Mode, type Qso, type WsjtxDecodeItem } from '@/lib/types'
import {
  bandFromFrequency,
  bandModeKey,
  callsignPrefix,
  CONTINENTS,
  continentFromCountry,
  countryFromCallsign,
  countryKey,
  modeToEnum,
  normalizeCountry,
  normalizeDecodeMode,
} from './decodeFormatters'

export type DecodeLogStatus = 'worked' | 'new-grid' | 'new-station' | 'unknown'
export type WantedReason = 'calling-me' | 'new-grid' | 'new-station' | 'new-band-mode' | 'worked'
export type AwardReason = 'dxcc' | 'dxcc-qsl' | 'dxcc-band' | 'dxcc-mode' | 'continent' | 'grid' | 'wpx' | 'band-mode' | 'calling-me' | 'worked'
export type MessageFilter = 'all' | 'CQ' | 'me' | '73'

export type DecodeRow = WsjtxDecodeItem & {
  distanceKm: number | null
  logStatus: DecodeLogStatus
  displayMode: string
  country: string
  continent: string
  prefix: string
  callsMe: boolean
  canRespond: boolean
  isNewBandMode: boolean
  isWorked: boolean
  isConfirmed: boolean
  needsConfirmation: boolean
  isDxccNeeded: boolean
  needsDxccConfirmation: boolean
  isNewDxccBand: boolean
  isNewDxccMode: boolean
  wantedReasons: WantedReason[]
  awardReasons: AwardReason[]
}

export type LogbookIndex = {
  callsigns: Set<string>
  grids: Set<string>
  bandModeSlots: Set<string>
  countries: Set<string>
  confirmedCallsigns: Set<string>
  confirmedCountries: Set<string>
  continents: Set<string>
  prefixes: Set<string>
  workedCountryBands: Set<string>
  confirmedCountryBands: Set<string>
  workedCountryModes: Set<string>
  confirmedCountryModes: Set<string>
  byCallsign: Map<string, Qso>
}

export type RosterBadgeKey = 'calling-me' | 'dxcc' | 'dxcc-qsl' | 'dxcc-band' | 'dxcc-mode' | 'continent' | 'grid' | 'band-mode' | 'new-station' | 'need-qsl' | 'confirmed' | 'worked' | 'lotw'

export type RosterBadge = {
  key: RosterBadgeKey
  label: string
  className: string
}

export type LiveRosterEntry = {
  callsign: string
  latest: DecodeRow
  decodes: DecodeRow[]
  priorityScore: number
  badges: RosterBadge[]
  logStatus: DecodeLogStatus
  awardReasons: AwardReason[]
  wantedReasons: WantedReason[]
  lotwLastUploadDate: string | null
}

export type RosterFilters = {
  messageFilter: MessageFilter
  search: string
  onlyNeeded: boolean
  onlyWithGrid: boolean
  onlyUnconfirmed: boolean
}

export type AwardSummary = {
  liveNeededDxcc: number
  liveNeededContinents: number
  liveNeededGrids: number
  liveNeededWpx: number
  liveNeededBandModes: number
  liveDxccNeedQsl: number
  liveNeededDxccBands: number
  liveNeededDxccModes: number
  workedCountries: number
  confirmedCountries: number
  opportunities: LiveRosterEntry[]
  continents: Array<{
    code: string
    label: string
    worked: boolean
    liveNeeded: boolean
    liveCount: number
  }>
}

export const EMPTY_LOGBOOK_INDEX: LogbookIndex = {
  callsigns: new Set(),
  grids: new Set(),
  bandModeSlots: new Set(),
  countries: new Set(),
  confirmedCallsigns: new Set(),
  confirmedCountries: new Set(),
  continents: new Set(),
  prefixes: new Set(),
  workedCountryBands: new Set(),
  confirmedCountryBands: new Set(),
  workedCountryModes: new Set(),
  confirmedCountryModes: new Set(),
  byCallsign: new Map(),
}

const CONTINENT_LABELS: Record<string, string> = {
  EU: 'Europa',
  NA: 'Nordamerika',
  SA: 'Sydamerika',
  AF: 'Afrika',
  AS: 'Asien',
  OC: 'Oceanien',
  AN: 'Antarktis',
}

export function buildLogbookIndex(qsos: Qso[]): LogbookIndex {
  const callsigns = new Set<string>()
  const grids = new Set<string>()
  const bandModeSlots = new Set<string>()
  const countries = new Set<string>()
  const confirmedCallsigns = new Set<string>()
  const confirmedCountries = new Set<string>()
  const continents = new Set<string>()
  const prefixes = new Set<string>()
  const workedCountryBands = new Set<string>()
  const confirmedCountryBands = new Set<string>()
  const workedCountryModes = new Set<string>()
  const confirmedCountryModes = new Set<string>()
  const byCallsign = new Map<string, Qso>()

  for (const qso of qsos) {
    const call = qso.workedCallsign?.toUpperCase()
    const confirmed = isQsoConfirmed(qso)
    if (call) {
      callsigns.add(call)
      if (confirmed) confirmedCallsigns.add(call)
      if (!byCallsign.has(call)) byCallsign.set(call, qso)
      bandModeSlots.add(bandModeKey(call, qso.band, qso.mode))
      const prefix = callsignPrefix(call)
      if (prefix) prefixes.add(prefix)
    }

    const grid = qso.locator?.toUpperCase()
    if (grid) grids.add(grid)

    const country = normalizeCountry(qso.country)
    if (country) {
      const key = countryKey(country)
      countries.add(key)
      if (confirmed) confirmedCountries.add(key)
      workedCountryBands.add(countryBandKey(key, qso.band))
      workedCountryModes.add(countryModeKey(key, qso.mode))
      if (confirmed) {
        confirmedCountryBands.add(countryBandKey(key, qso.band))
        confirmedCountryModes.add(countryModeKey(key, qso.mode))
      }
    }

    const continent = qso.continent?.toUpperCase() || continentFromCountry(qso.country)
    if (continent) continents.add(continent)
  }

  return {
    callsigns,
    grids,
    bandModeSlots,
    countries,
    confirmedCallsigns,
    confirmedCountries,
    continents,
    prefixes,
    workedCountryBands,
    confirmedCountryBands,
    workedCountryModes,
    confirmedCountryModes,
    byCallsign,
  }
}

export function enrichDecode(decode: WsjtxDecodeItem, logbook: LogbookIndex, ownCallsign: string): DecodeRow {
  const displayMode = normalizeDecodeMode(decode)
  const callsMe = decodeCallsMe(decode.message, ownCallsign)
  const country = normalizeCountry(decode.dxCountry) || countryFromCallsign(decode.dxCallsign)
  const continent = decode.dxContinent || continentFromCountry(country)
  const prefix = decode.dxWpxPrefix || callsignPrefix(decode.dxCallsign)
  const wantedReasons = getWantedReasons(decode, logbook, callsMe, displayMode)
  const awardReasons = getAwardReasons(decode, logbook, callsMe, displayMode, country, continent, prefix)
  const band = bandFromFrequency(decode.frequencyMhz)
  const mode = modeToEnum(displayMode)
  const call = decode.dxCallsign?.toUpperCase()
  const normalizedCountry = countryKey(country)
  const isWorked = Boolean(call && logbook.callsigns.has(call))
  const isConfirmed = Boolean(call && logbook.confirmedCallsigns.has(call))
  const isDxccNeeded = Boolean(normalizedCountry && !logbook.countries.has(normalizedCountry))
  const needsDxccConfirmation = Boolean(normalizedCountry && logbook.countries.has(normalizedCountry) && !logbook.confirmedCountries.has(normalizedCountry))
  const isNewDxccBand = Boolean(normalizedCountry && band && logbook.countries.has(normalizedCountry) && !logbook.workedCountryBands.has(countryBandKey(normalizedCountry, band)))
  const isNewDxccMode = Boolean(normalizedCountry && mode && logbook.countries.has(normalizedCountry) && !logbook.workedCountryModes.has(countryModeKey(normalizedCountry, mode)))

  return {
    ...decode,
    distanceKm: decode.dxGrid && decode.spotterGrid ? distanceKm(decode.spotterGrid, decode.dxGrid) : null,
    logStatus: getDecodeLogStatus(decode, logbook),
    displayMode,
    country,
    continent,
    prefix,
    callsMe,
    canRespond: decode.isCallable || callsMe,
    isNewBandMode: Boolean(call && band && mode && logbook.callsigns.has(call) && !logbook.bandModeSlots.has(bandModeKey(call, band, mode))),
    isWorked,
    isConfirmed,
    needsConfirmation: isWorked && !isConfirmed,
    isDxccNeeded,
    needsDxccConfirmation,
    isNewDxccBand,
    isNewDxccMode,
    wantedReasons,
    awardReasons,
  }
}

export function buildRosterEntries(rows: DecodeRow[], lotwActivity: Record<string, string> = {}): LiveRosterEntry[] {
  const grouped = new Map<string, DecodeRow[]>()

  for (const row of rows) {
    const callsign = row.dxCallsign?.trim().toUpperCase()
    if (!callsign) continue
    const group = grouped.get(callsign) ?? []
    group.push(row)
    grouped.set(callsign, group)
  }

  return Array.from(grouped.entries())
    .map(([callsign, decodes]) => {
      const sortedDecodes = [...decodes].sort((a, b) => new Date(b.decodedAt).getTime() - new Date(a.decodedAt).getTime())
      const latest = sortedDecodes[0]
      const awardReasons = uniqueReasons(sortedDecodes.flatMap(row => row.awardReasons))
      const wantedReasons = uniqueReasons(sortedDecodes.flatMap(row => row.wantedReasons))
      const entry: LiveRosterEntry = {
        callsign,
        latest,
        decodes: sortedDecodes,
        priorityScore: 0,
        badges: [],
        logStatus: latest.logStatus,
        awardReasons,
        wantedReasons,
        lotwLastUploadDate: lotwActivity[callsign] ?? null,
      }
      entry.priorityScore = rosterPriorityScore(entry)
      entry.badges = buildRosterBadges(entry)
      return entry
    })
    .sort((a, b) => b.priorityScore - a.priorityScore || new Date(b.latest.decodedAt).getTime() - new Date(a.latest.decodedAt).getTime() || a.callsign.localeCompare(b.callsign))
}

export function filterRosterEntries(entries: LiveRosterEntry[], filters: RosterFilters): LiveRosterEntry[] {
  return entries.filter(entry => {
    if (filters.onlyNeeded && !isNeededEntry(entry)) return false
    if (filters.onlyUnconfirmed && !entry.latest.needsConfirmation) return false
    if (filters.onlyWithGrid && !gridToLatLng(entry.latest.dxGrid)) return false
    if (!rowMatchesMessageFilter(entry.latest, filters.messageFilter)) return false
    if (filters.search && !entryMatchesSearch(entry, filters.search)) return false
    return true
  })
}

export function buildAwardSummary(entries: LiveRosterEntry[], logbook: LogbookIndex): AwardSummary {
  const liveNeededDxcc = new Set<string>()
  const liveNeededContinents = new Set<string>()
  const liveNeededGrids = new Set<string>()
  const liveNeededWpx = new Set<string>()
  const liveDxccNeedQsl = new Set<string>()
  const liveNeededDxccBands = new Set<string>()
  const liveNeededDxccModes = new Set<string>()
  let liveNeededBandModes = 0

  for (const entry of entries) {
    const row = entry.latest
    if (entry.awardReasons.includes('dxcc')) liveNeededDxcc.add(countryKey(row.country))
    if (entry.awardReasons.includes('dxcc-qsl')) liveDxccNeedQsl.add(countryKey(row.country))
    if (entry.awardReasons.includes('dxcc-band')) {
      const band = bandFromFrequency(row.frequencyMhz)
      if (band) liveNeededDxccBands.add(countryBandKey(countryKey(row.country), band))
    }
    if (entry.awardReasons.includes('dxcc-mode')) {
      const mode = modeToEnum(row.displayMode)
      if (mode) liveNeededDxccModes.add(countryModeKey(countryKey(row.country), mode))
    }
    if (entry.awardReasons.includes('continent') && row.continent) liveNeededContinents.add(row.continent)
    if (entry.awardReasons.includes('grid') && row.dxGrid) liveNeededGrids.add(row.dxGrid.toUpperCase())
    if (entry.awardReasons.includes('wpx') && row.prefix) liveNeededWpx.add(row.prefix)
    if (entry.awardReasons.includes('band-mode')) liveNeededBandModes += 1
  }

  return {
    liveNeededDxcc: liveNeededDxcc.size,
    liveNeededContinents: liveNeededContinents.size,
    liveNeededGrids: liveNeededGrids.size,
    liveNeededWpx: liveNeededWpx.size,
    liveNeededBandModes,
    liveDxccNeedQsl: liveDxccNeedQsl.size,
    liveNeededDxccBands: liveNeededDxccBands.size,
    liveNeededDxccModes: liveNeededDxccModes.size,
    workedCountries: logbook.countries.size,
    confirmedCountries: logbook.confirmedCountries.size,
    opportunities: entries.filter(isNeededEntry).slice(0, 6),
    continents: CONTINENTS.map(code => {
      const liveCount = entries.filter(entry => entry.latest.continent === code).length
      const worked = logbook.continents.has(code)
      return {
        code,
        label: CONTINENT_LABELS[code],
        worked,
        liveCount,
        liveNeeded: liveCount > 0 && !worked,
      }
    }),
  }
}

export function decodeCallsMe(message: string, callsign: string | null | undefined) {
  const ownCallsign = callsign?.trim().toUpperCase()
  if (!ownCallsign) return false

  const tokens = message
    .toUpperCase()
    .split(/\s+/)
    .map(token => token.replace(/^[^A-Z0-9/]+|[^A-Z0-9/]+$/g, ''))
    .filter(Boolean)

  return tokens.includes(ownCallsign)
}

export function rowMatchesMessageFilter(row: DecodeRow, messageFilter: MessageFilter) {
  const message = row.message.toUpperCase()
  if (messageFilter === 'CQ') return message.startsWith('CQ ') || message.includes(' CQ ')
  if (messageFilter === 'me') return row.callsMe
  if (messageFilter === '73') return message.includes('73')
  return true
}

export function isRelatedMessage(decode: WsjtxDecodeItem, selected: WsjtxDecodeItem) {
  const own = selected.spotterCallsign?.toUpperCase()
  const dx = selected.dxCallsign?.toUpperCase()
  const message = decode.message.toUpperCase()
  return Boolean((own && message.includes(own)) || (dx && message.includes(dx)))
}

function getDecodeLogStatus(decode: WsjtxDecodeItem, logbook: LogbookIndex): DecodeLogStatus {
  const call = decode.dxCallsign?.toUpperCase()
  if (!call) return 'unknown'
  if (logbook.callsigns.has(call)) return 'worked'

  const grid = decode.dxGrid?.toUpperCase()
  if (grid && !logbook.grids.has(grid)) return 'new-grid'

  return 'new-station'
}

function getWantedReasons(decode: WsjtxDecodeItem, logbook: LogbookIndex, callsMe: boolean, displayMode: string): WantedReason[] {
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
  if (normalizedCountry && logbook.countries.has(normalizedCountry) && !logbook.confirmedCountries.has(normalizedCountry)) reasons.push('dxcc-qsl')
  if (normalizedCountry && band && logbook.countries.has(normalizedCountry) && !logbook.workedCountryBands.has(countryBandKey(normalizedCountry, band))) reasons.push('dxcc-band')
  if (normalizedCountry && mode && logbook.countries.has(normalizedCountry) && !logbook.workedCountryModes.has(countryModeKey(normalizedCountry, mode))) reasons.push('dxcc-mode')
  if (continent && !logbook.continents.has(continent)) reasons.push('continent')
  if (grid && !logbook.grids.has(grid)) reasons.push('grid')
  if (prefix && !logbook.prefixes.has(prefix)) reasons.push('wpx')
  if (band && mode && isWorked && !logbook.bandModeSlots.has(bandModeKey(call, band, mode))) reasons.push('band-mode')
  if (isWorked) reasons.push('worked')

  return Array.from(new Set(reasons))
}

function rosterPriorityScore(entry: LiveRosterEntry) {
  return (
    (entry.awardReasons.includes('calling-me') || entry.wantedReasons.includes('calling-me') ? 100000 : 0) +
    (entry.awardReasons.includes('dxcc') ? 50000 : 0) +
    (entry.awardReasons.includes('dxcc-qsl') ? 45000 : 0) +
    (entry.awardReasons.includes('continent') ? 40000 : 0) +
    (entry.awardReasons.includes('grid') ? 30000 : 0) +
    (entry.awardReasons.includes('dxcc-band') ? 26000 : 0) +
    (entry.awardReasons.includes('dxcc-mode') ? 24000 : 0) +
    (entry.awardReasons.includes('band-mode') ? 20000 : 0) +
    (entry.wantedReasons.includes('new-station') ? 10000 : 0) +
    (entry.awardReasons.includes('worked') ? 1000 : 0) +
    Math.max(0, entry.latest.snr + 40)
  )
}

function buildRosterBadges(entry: LiveRosterEntry): RosterBadge[] {
  const badges: RosterBadge[] = []
  if (entry.awardReasons.includes('calling-me') || entry.wantedReasons.includes('calling-me')) badges.push(badge('calling-me', 'Calling me', 'border-red-700 bg-red-950 text-red-100'))
  if (entry.awardReasons.includes('dxcc')) badges.push(badge('dxcc', 'Ny DXCC', 'border-amber-700 bg-amber-950 text-amber-100'))
  if (entry.awardReasons.includes('dxcc-qsl')) badges.push(badge('dxcc-qsl', 'DXCC need QSL', 'border-orange-700 bg-orange-950 text-orange-100'))
  if (entry.awardReasons.includes('dxcc-band')) badges.push(badge('dxcc-band', 'New band', 'border-fuchsia-700 bg-fuchsia-950 text-fuchsia-100'))
  if (entry.awardReasons.includes('dxcc-mode')) badges.push(badge('dxcc-mode', 'New mode', 'border-purple-700 bg-purple-950 text-purple-100'))
  if (entry.awardReasons.includes('continent')) badges.push(badge('continent', 'New continent', 'border-pink-700 bg-pink-950 text-pink-100'))
  if (entry.awardReasons.includes('grid')) badges.push(badge('grid', 'New grid', 'border-sky-700 bg-sky-950 text-sky-100'))
  if (entry.awardReasons.includes('band-mode')) badges.push(badge('band-mode', 'New band/mode', 'border-violet-700 bg-violet-950 text-violet-100'))
  if (entry.wantedReasons.includes('new-station')) badges.push(badge('new-station', 'New station', 'border-cyan-700 bg-cyan-950 text-cyan-100'))
  if (entry.latest.needsConfirmation) badges.push(badge('need-qsl', 'Need QSL', 'border-yellow-700 bg-yellow-950 text-yellow-100'))
  if (entry.latest.isConfirmed) badges.push(badge('confirmed', 'Confirmed', 'border-emerald-700 bg-emerald-950 text-emerald-100'))
  if (entry.awardReasons.includes('worked')) badges.push(badge('worked', 'Worked B4', 'border-green-800 bg-green-950 text-green-100'))
  if (entry.lotwLastUploadDate) badges.push(badge('lotw', 'LoTW', 'border-lime-800 bg-lime-950 text-lime-100'))
  return badges
}

function badge(key: RosterBadgeKey, label: string, className: string): RosterBadge {
  return { key, label, className }
}

function isNeededEntry(entry: LiveRosterEntry) {
  return entry.badges.some(badge => !['worked', 'confirmed', 'lotw'].includes(badge.key))
}

function entryMatchesSearch(entry: LiveRosterEntry, search: string) {
  const needle = search.trim().toLowerCase()
  if (!needle) return true
  const row = entry.latest
  const haystack = [
    entry.callsign,
    row.dxGrid,
    row.country,
    row.continent,
    row.prefix,
    row.message,
    row.displayMode,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(needle)
}

function uniqueReasons<T extends string>(reasons: T[]) {
  return Array.from(new Set(reasons))
}

export function isQsoConfirmed(qso: Qso) {
  return Boolean(
    qso.lotwConfirmedAt ||
    qso.eqslConfirmedAt ||
    qso.qrzConfirmedAt ||
    qso.qrzConfirmationStatus?.toUpperCase() === 'C'
  )
}

function countryBandKey(country: string, band: Band | number | string) {
  return `${country}|${Number(band)}`
}

function countryModeKey(country: string, mode: Mode | number | string) {
  return `${country}|${Number(mode)}`
}
