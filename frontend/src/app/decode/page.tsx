'use client'

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { api } from '@/lib/api'
import { type Qso, type WsjtxDecodeItem, type WsjtxStatus } from '@/lib/types'
import AwardProgressPanel from './components/AwardProgressPanel'
import LiveMapPanel from './components/LiveMapPanel'
import LiveRoster from './components/LiveRoster'
import RawDecodeDrawer from './components/RawDecodeDrawer'
import SelectedStationPanel from './components/SelectedStationPanel'
import {
  buildAwardSummary,
  buildLogbookIndex,
  buildRosterEntries,
  EMPTY_LOGBOOK_INDEX,
  enrichDecode,
  filterRosterEntries,
  isRelatedMessage,
  type DecodeRow,
  type RosterFilters,
} from './decodeScoring'
import { commandResultMessage, selectedCallsignForCommand } from './decodeUiState'
import { EMPTY_QSO_FORM, qsoFormPayload, qsoToEditForm, type QsoEditForm } from './qsoEdit'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.hamhub.dk'
const MAX_ROWS = 200

const DEFAULT_ROSTER_FILTERS: RosterFilters = {
  messageFilter: 'all',
  search: '',
  onlyNeeded: false,
  onlyWithGrid: false,
}

export default function DecodePage() {
  const { isLoading } = useRequireAuth()
  const { isAuthenticated, user } = useAuth()
  const ownCallsign = user?.callsign?.toUpperCase() ?? ''

  const [decodes, setDecodes] = useState<WsjtxDecodeItem[]>([])
  const [connected, setConnected] = useState(false)
  const [commandStatus, setCommandStatus] = useState<string | null>(null)
  const [pendingCommand, setPendingCommand] = useState(false)
  const [qsos, setQsos] = useState<Qso[]>([])
  const [selectedCallsign, setSelectedCallsign] = useState('')
  const [wsjtxStatus, setWsjtxStatus] = useState<WsjtxStatus | null>(null)
  const [agentConnected, setAgentConnected] = useState(false)
  const [txCountByCall, setTxCountByCall] = useState<Record<string, number>>({})
  const [qsoDrafts, setQsoDrafts] = useState<Record<number, QsoEditForm>>({})
  const [qsoSaveStatuses, setQsoSaveStatuses] = useState<Record<number, string>>({})
  const [qsoSaving, setQsoSaving] = useState(false)
  const [rosterFilters, setRosterFilters] = useState<RosterFilters>(DEFAULT_ROSTER_FILTERS)
  const [rawOpen, setRawOpen] = useState(false)
  const lastTxRef = useRef({ call: '', transmitting: false })
  const latestCommandResultIdRef = useRef('')

  useEffect(() => {
    if (isAuthenticated) {
      api.qsos.getMine().then(setQsos).catch(() => {})
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return

    api.wsjtx.getRecentDecodes(MAX_ROWS)
      .then(items => setDecodes(items))
      .catch(() => {})

    const es = new EventSource(`${API_URL}/api/wsjtx/stream`)
    es.onopen = () => setConnected(true)
    es.onmessage = event => {
      setConnected(true)
      const decode: WsjtxDecodeItem = JSON.parse(event.data)
      setDecodes(previous => {
        const next = [decode, ...previous]
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
        if (!cancelled) {
          setWsjtxStatus(status)
          const updatedAt = status ? new Date(status.updatedAtUtc).getTime() : 0
          setAgentConnected(Boolean(updatedAt && Date.now() - updatedAt < 30_000))
        }
      } catch {
        if (!cancelled) {
          setWsjtxStatus(null)
          setAgentConnected(false)
        }
      }
    }

    refreshStatus()
    const timer = window.setInterval(refreshStatus, 1000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return

    let cancelled = false
    const refreshCommandResults = async () => {
      try {
        const results = await api.wsjtx.getCommandResults()
        const latest = results[0]
        if (!latest || cancelled || latest.id === latestCommandResultIdRef.current) return
        latestCommandResultIdRef.current = latest.id
        setCommandStatus(commandResultMessage(latest))
      } catch {
        // Command result polling is advisory; status polling and live decodes should keep running.
      }
    }

    refreshCommandResults()
    const timer = window.setInterval(refreshCommandResults, 1000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [isAuthenticated])

  const logbook = useMemo(() => qsos.length ? buildLogbookIndex(qsos) : EMPTY_LOGBOOK_INDEX, [qsos])
  const rows = useMemo(() => decodes.map(decode => enrichDecode(decode, logbook, ownCallsign)), [decodes, logbook, ownCallsign])
  const roster = useMemo(() => buildRosterEntries(rows), [rows])
  const filteredRoster = useMemo(() => filterRosterEntries(roster, rosterFilters), [roster, rosterFilters])
  const selectedEntry = useMemo(() => {
    return roster.find(entry => entry.callsign === selectedCallsign) ?? filteredRoster[0] ?? null
  }, [filteredRoster, roster, selectedCallsign])
  const selectedDecode = selectedEntry?.latest ?? null
  const selectedCall = selectedEntry?.callsign ?? ''
  const awardSummary = useMemo(() => buildAwardSummary(roster, logbook), [logbook, roster])

  const selectedTrail = useMemo(() => {
    if (!selectedDecode) return []
    return decodes.filter(decode => isRelatedMessage(decode, selectedDecode)).slice(0, 30)
  }, [decodes, selectedDecode])

  const selectedLoggedQso = useMemo(() => {
    return selectedCall ? logbook.byCallsign.get(selectedCall) ?? null : null
  }, [logbook, selectedCall])
  const qsoForm = selectedLoggedQso ? qsoDrafts[selectedLoggedQso.id] ?? qsoToEditForm(selectedLoggedQso) : EMPTY_QSO_FORM
  const qsoSaveStatus = selectedLoggedQso
    ? qsoSaveStatuses[selectedLoggedQso.id] ?? 'QSO modtaget fra WSJT-X. Gennemse og gem eventuelle rettelser.'
    : null

  const wsjtxStatusCall = wsjtxStatus?.dxCall?.toUpperCase() ?? ''
  const wsjtxIsOnSelectedCall = Boolean(selectedCall && wsjtxStatusCall === selectedCall)
  const wsjtxIsSendingSelectedCall = Boolean(wsjtxIsOnSelectedCall && wsjtxStatus?.transmitting)
  const selectedTxCount = selectedCall ? txCountByCall[selectedCall] ?? 0 : 0

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
    if (!selectedCall || selectedLoggedQso) return

    let cancelled = false
    const refreshSelectedQso = async () => {
      try {
        const matches = await api.qsos.getMine(selectedCall)
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
  }, [selectedCall, selectedLoggedQso])

  const handleSelectEntry = (entry: { callsign: string }) => {
    setSelectedCallsign(entry.callsign)
    setCommandStatus(null)
  }

  const handleCallDecode = async (decode: DecodeRow) => {
    if (!decode.canRespond || pendingCommand) return
    try {
      setPendingCommand(true)
      const call = decode.dxCallsign?.toUpperCase()
      if (call) {
        setSelectedCallsign(selectedCallsignForCommand(selectedCallsign, decode))
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
    if (!selectedLoggedQso) return
    const value = event.target.value
    setQsoDrafts(current => ({
      ...current,
      [selectedLoggedQso.id]: {
        ...(current[selectedLoggedQso.id] ?? qsoToEditForm(selectedLoggedQso)),
        [key]: value,
      },
    }))
  }

  const handleSaveLoggedQso = async (event: FormEvent) => {
    event.preventDefault()
    if (!selectedLoggedQso || qsoSaving) return
    try {
      setQsoSaving(true)
      setQsoSaveStatuses(current => ({ ...current, [selectedLoggedQso.id]: 'Gemmer QSO...' }))
      const updated = await api.qsos.update(selectedLoggedQso.id, qsoFormPayload(qsoForm))
      setQsos(current => mergeQsos(current, [updated]))
      setQsoDrafts(current => {
        const next = { ...current }
        delete next[selectedLoggedQso.id]
        return next
      })
      setQsoSaveStatuses(current => ({ ...current, [selectedLoggedQso.id]: 'QSO gemt i HamHub.' }))
    } catch (err) {
      setQsoSaveStatuses(current => ({
        ...current,
        [selectedLoggedQso.id]: err instanceof Error ? err.message : 'Kunne ikke gemme QSO',
      }))
    } finally {
      setQsoSaving(false)
    }
  }

  if (isLoading || !isAuthenticated) return null

  return (
    <div className="mx-auto max-w-[1800px] px-4 py-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(420px,0.95fr)_minmax(520px,1.05fr)]">
        <LiveRoster
          entries={filteredRoster}
          selectedCallsign={selectedCall}
          filters={rosterFilters}
          connected={connected}
          wsjtxStatus={wsjtxStatus}
          agentConnected={agentConnected}
          totalDecodes={decodes.length}
          onFiltersChange={setRosterFilters}
          onSelect={handleSelectEntry}
          onOpenRaw={() => setRawOpen(true)}
          onStopTx={handleStopTx}
          pendingCommand={pendingCommand}
          ownCallsign={ownCallsign}
        />

        <div className="space-y-4">
          <SelectedStationPanel
            entry={selectedEntry}
            selectedTrail={selectedTrail}
            selectedLoggedQso={selectedLoggedQso}
            wsjtxStatus={wsjtxStatus}
            wsjtxIsOnSelectedCall={wsjtxIsOnSelectedCall}
            wsjtxIsSendingSelectedCall={wsjtxIsSendingSelectedCall}
            selectedTxCount={selectedTxCount}
            commandStatus={commandStatus}
            pendingCommand={pendingCommand}
            qsoForm={qsoForm}
            qsoSaving={qsoSaving}
            qsoSaveStatus={qsoSaveStatus}
            onCallDecode={handleCallDecode}
            onStopTx={handleStopTx}
            onQsoFieldChange={setQsoField}
            onSaveLoggedQso={handleSaveLoggedQso}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <LiveMapPanel entries={filteredRoster} onSelectCallsign={callsign => handleSelectEntry({ callsign })} />
            <AwardProgressPanel summary={awardSummary} onSelect={handleSelectEntry} />
          </div>
        </div>
      </div>

      <RawDecodeDrawer
        open={rawOpen}
        rows={rows}
        onClose={() => setRawOpen(false)}
        onSelectDecode={decode => {
          if (decode.dxCallsign) handleSelectEntry({ callsign: decode.dxCallsign.toUpperCase() })
        }}
      />
    </div>
  )
}

function mergeQsos(current: Qso[], incoming: Qso[]) {
  const byId = new Map(current.map(qso => [qso.id, qso]))
  for (const qso of incoming) byId.set(qso.id, qso)
  return Array.from(byId.values()).sort((a, b) => new Date(b.dateUtc).getTime() - new Date(a.dateUtc).getTime())
}
