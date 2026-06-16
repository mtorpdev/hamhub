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
  callsMe: boolean
  canRespond: boolean
}

type DecodeLogStatus = 'worked' | 'new-grid' | 'new-station' | 'unknown'
type MessageFilter = 'all' | 'CQ' | 'me' | '73'
type DecodeView = 'grid' | 'map'
type DecodeMapMarker = MapMarker & {
  decodeId: number
}

type LogbookIndex = {
  callsigns: Set<string>
  grids: Set<string>
  byCallsign: Map<string, Qso>
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
  byCallsign: new Map(),
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
  const byCallsign = new Map<string, Qso>()

  for (const qso of qsos) {
    const call = qso.workedCallsign?.toUpperCase()
    if (call) {
      callsigns.add(call)
      if (!byCallsign.has(call)) byCallsign.set(call, qso)
    }

    const grid = qso.locator?.toUpperCase()
    if (grid) grids.add(grid)
  }

  return { callsigns, grids, byCallsign }
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

function normalizeCallsignForCountry(callsign: string | null) {
  return callsign
    ?.toUpperCase()
    .replace(/[<>]/g, '')
    .split('/')[0]
    .replace(/[^A-Z0-9]/g, '') ?? ''
}

function countryFromCallsign(callsign: string | null) {
  const normalized = normalizeCallsignForCountry(callsign)
  if (!normalized) return '-'
  return CALLSIGN_COUNTRY_PREFIXES.find(([pattern]) => pattern.test(normalized))?.[1] ?? 'Ukendt'
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
      .map(d => ({
        ...d,
        distanceKm: distanceKm(d.spotterGrid, d.dxGrid),
        logStatus: getDecodeLogStatus(d, logbook),
        displayMode: normalizeDecodeMode(d),
        country: countryFromCallsign(d.dxCallsign),
        callsMe: decodeCallsMe(d.message, ownCallsign),
        canRespond: d.isCallable || decodeCallsMe(d.message, ownCallsign),
      }))
      .filter(row => rowMatchesMessageFilter(row, messageFilter))
      .filter(row => !onlyWithGrid || Boolean(row.dxGrid))
      .filter(row => rowMatchesQuickSearch(row, quickSearch))
  }, [decodes, logbook, messageFilter, onlyWithGrid, ownCallsign, quickSearch])

  const mapRows = useMemo(() => rows.filter(row => Boolean(gridToLatLng(row.dxGrid))), [rows])

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
      ) : (
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
