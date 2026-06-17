'use client'

import { Card, CardContent } from '@/components/ui/Card'
import { type Qso, type WsjtxDecodeItem, type WsjtxStatus } from '@/lib/types'
import { bandModeLabel, formatTime, snrText } from '../decodeFormatters'
import { type DecodeRow, type LiveRosterEntry } from '../decodeScoring'
import { commandDecodeForEntry } from '../decodeUiState'

type SelectedStationPanelProps = {
  entry: LiveRosterEntry | null
  selectedTrail: WsjtxDecodeItem[]
  selectedLoggedQso: Qso | null
  wsjtxStatus: WsjtxStatus | null
  wsjtxIsOnSelectedCall: boolean
  wsjtxIsSendingSelectedCall: boolean
  selectedTxCount: number
  commandStatus: string | null
  pendingCommand: boolean
  onCallDecode: (decode: DecodeRow) => void
  onStopTx: () => void
}

export default function SelectedStationPanel({
  entry,
  selectedTrail,
  selectedLoggedQso,
  wsjtxStatus,
  wsjtxIsOnSelectedCall,
  wsjtxIsSendingSelectedCall,
  selectedTxCount,
  commandStatus,
  pendingCommand,
  onCallDecode,
  onStopTx,
}: SelectedStationPanelProps) {
  if (!entry) {
    return (
      <Card>
        <CardContent className="flex min-h-[280px] items-center justify-center p-6 text-sm text-gray-500">
          Vælg en station i live rosteren.
        </CardContent>
      </Card>
    )
  }

  const decode = entry.latest
  const commandDecode = commandDecodeForEntry(entry)

  return (
    <Card>
      <CardContent className="space-y-4 p-0">
        <div className="border-b border-gray-800 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase text-gray-500">Selected station</p>
              <h2 className="mt-1 font-mono text-3xl font-bold text-white">{entry.callsign}</h2>
              <p className="mt-1 font-mono text-sm text-gray-400">{decode.message}</p>
            </div>
            <div className="text-right">
              <p className={`font-mono text-2xl font-bold ${decode.snr >= 0 ? 'text-green-300' : decode.snr >= -10 ? 'text-yellow-300' : 'text-red-300'}`}>
                {snrText(decode.snr)}
              </p>
              <p className="text-xs text-gray-500">{formatTime(decode.decodedAt)}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            {entry.badges.map(badge => (
              <span key={badge.key} className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${badge.className}`}>
                {badge.label}
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-4 px-5 md:grid-cols-4">
          <Info label="Grid" value={decode.dxGrid ?? '-'} />
          <Info label="Afstand" value={decode.distanceKm ? `${decode.distanceKm.toLocaleString('da-DK')} km` : '-'} />
          <Info label="Land" value={decode.country || '-'} />
          <Info label="Band/mode" value={bandModeLabel(decode)} />
          <Info label="Kontinent" value={decode.continent || '-'} />
          <Info label="WPX" value={decode.prefix || '-'} />
          <Info label="CQ/ITU" value={`CQ ${decode.dxCqZone ?? '-'} / ITU ${decode.dxItuZone ?? '-'}`} />
          <Info label="Frekvens" value={`${decode.frequencyMhz.toFixed(3)} MHz`} />
        </div>

        <div className="border-y border-gray-800 bg-gray-900/40 px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1 text-sm text-gray-400">
              <div>
                <span className="text-gray-500">Din station:</span>{' '}
                <span className="font-mono text-gray-200">{decode.spotterCallsign}</span>
                {decode.spotterGrid && <span className="font-mono text-gray-500"> / {decode.spotterGrid}</span>}
              </div>
              <div>
                <span className="text-gray-500">HamHub log:</span>{' '}
                {selectedLoggedQso ? (
                  <span className="text-green-300">Logget {formatTime(selectedLoggedQso.dateUtc)}</span>
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
                type="button"
                onClick={() => onCallDecode(commandDecode)}
                disabled={pendingCommand || !commandDecode.canRespond}
                className="bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-400"
              >
                {commandDecode.callsMe ? 'Svar i WSJT-X' : 'Kald station'}
              </button>
              <button
                type="button"
                onClick={onStopTx}
                disabled={pendingCommand}
                className="border border-red-800 bg-red-950 px-4 py-2 text-sm font-semibold text-red-100 hover:bg-red-900 disabled:border-gray-700 disabled:bg-gray-800 disabled:text-gray-500"
              >
                Stop kald
              </button>
            </div>
          </div>
          {commandStatus && <p className="mt-3 text-sm text-gray-300">{commandStatus}</p>}
        </div>

        <div className="px-5 pb-5">
          <h3 className="mb-3 text-sm font-semibold text-white">Kommunikation</h3>
          <div className="max-h-52 overflow-auto border border-gray-800 bg-black/30">
            {selectedTrail.length > 0 ? selectedTrail.map(item => (
              <div key={`${item.id}-${item.decodedAt}`} className="grid grid-cols-[72px_54px_1fr] gap-3 border-b border-gray-900 px-3 py-2 text-sm last:border-b-0">
                <span className="font-mono text-xs text-gray-500">{formatTime(item.decodedAt)}</span>
                <span className="font-mono text-xs text-gray-400">{snrText(item.snr)}</span>
                <span className="font-mono text-gray-200">{item.message}</span>
              </div>
            )) : (
              <p className="px-3 py-6 text-center text-sm text-gray-500">Ingen relaterede decodes endnu.</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
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

function formatWsjtxStatus(status: WsjtxStatus | null, isOnSelectedCall: boolean, isSendingSelectedCall: boolean) {
  if (!status) return 'Ingen status fra WSJT-X endnu'
  if (status.txWatchdog) return 'TX stoppet af WSJT-X watchdog'
  if (isSendingSelectedCall) return 'Sender nu'
  if (isOnSelectedCall && status.txEnabled) return 'Klar til TX'
  if (isOnSelectedCall) return 'Valgt i WSJT-X'
  if (status.dxCall) return `WSJT-X er på ${status.dxCall}`
  return status.txEnabled ? 'Auto TX er aktiv' : 'Ikke i call mode'
}
