'use client'

import { Card, CardContent } from '@/components/ui/Card'
import { type Qso, type WsjtxDecodeItem, type WsjtxStatus } from '@/lib/types'
import { useLanguage } from '@/i18n/LanguageContext'
import { bandModeLabel, formatTime, snrText } from '../decodeFormatters'
import { type DecodeRow, type LiveRosterEntry, type RosterBadgeKey } from '../decodeScoring'
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
  const { t, language } = useLanguage()
  if (!entry) {
    return (
      <Card>
        <CardContent className="flex min-h-[280px] items-center justify-center p-6 text-sm text-gray-500">
          {t('decode.selected.empty')}
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
              <p className="text-xs uppercase text-gray-500">{t('decode.selected.title')}</p>
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
                {rosterBadgeLabel(badge.key, t)}
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-4 px-5 md:grid-cols-4">
          <Info label={t('qso.gridLocator')} value={decode.dxGrid ?? '-'} />
          <Info label={t('decode.selected.distance')} value={decode.distanceKm ? `${decode.distanceKm.toLocaleString(language)} km` : '-'} />
          <Info label={t('qso.country')} value={decode.country || '-'} />
          <Info label={t('decode.selected.bandMode')} value={bandModeLabel(decode)} />
          <Info label={t('decode.selected.continent')} value={decode.continent || '-'} />
          <Info label="WPX" value={decode.prefix || '-'} />
          <Info label={t('decode.selected.cqItu')} value={`CQ ${decode.dxCqZone ?? '-'} / ITU ${decode.dxItuZone ?? '-'}`} />
          <Info label={t('qso.frequencyMhz')} value={`${decode.frequencyMhz.toFixed(3)} MHz`} />
        </div>

        <div className="border-y border-gray-800 bg-gray-900/40 px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1 text-sm text-gray-400">
              <div>
                <span className="text-gray-500">{t('decode.selected.yourStation')}:</span>{' '}
                <span className="font-mono text-gray-200">{decode.spotterCallsign}</span>
                {decode.spotterGrid && <span className="font-mono text-gray-500"> / {decode.spotterGrid}</span>}
              </div>
              <div>
                <span className="text-gray-500">{t('decode.selected.hamHubLog')}:</span>{' '}
                {selectedLoggedQso ? (
                  <span className="text-green-300">{t('decode.selected.loggedAt', { time: formatTime(selectedLoggedQso.dateUtc) })}</span>
                ) : (
                  <span className="text-amber-300">{t('decode.selected.waitingForLogged')}</span>
                )}
              </div>
              <div>
                <span className="text-gray-500">WSJT-X:</span>{' '}
                <span className={wsjtxIsSendingSelectedCall ? 'font-semibold text-green-300' : wsjtxStatus?.txWatchdog ? 'font-semibold text-red-300' : 'text-gray-200'}>
                  {formatWsjtxStatus(wsjtxStatus, wsjtxIsOnSelectedCall, wsjtxIsSendingSelectedCall, t)}
                </span>
                {wsjtxStatus && (
                  <span className="font-mono text-gray-500">
                    {' '}TX {wsjtxStatus.txEnabled ? 'on' : 'off'} / DF {wsjtxStatus.txDf || '-'}
                  </span>
                )}
              </div>
              <div>
                <span className="text-gray-500">{t('decode.selected.calls')}:</span>{' '}
                <span className="font-mono text-gray-200">{selectedTxCount}</span>
                <span className="text-gray-500"> {t('decode.selected.txPeriods')}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onCallDecode(commandDecode)}
                disabled={pendingCommand || !commandDecode.canRespond}
                className="bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-400"
              >
                {commandDecode.callsMe ? t('decode.replyInWsjtx') : t('decode.callStation')}
              </button>
              <button
                type="button"
                onClick={onStopTx}
                disabled={pendingCommand}
                className="border border-red-800 bg-red-950 px-4 py-2 text-sm font-semibold text-red-100 hover:bg-red-900 disabled:border-gray-700 disabled:bg-gray-800 disabled:text-gray-500"
              >
                {t('decode.stopCall')}
              </button>
            </div>
          </div>
          {commandStatus && <p className="mt-3 text-sm text-gray-300">{commandStatus}</p>}
        </div>

        <div className="px-5 pb-5">
          <h3 className="mb-3 text-sm font-semibold text-white">{t('decode.selected.communication')}</h3>
          <div className="max-h-52 overflow-auto border border-gray-800 bg-black/30">
            {selectedTrail.length > 0 ? selectedTrail.map(item => (
              <div key={`${item.id}-${item.decodedAt}`} className="grid grid-cols-[72px_54px_1fr] gap-3 border-b border-gray-900 px-3 py-2 text-sm last:border-b-0">
                <span className="font-mono text-xs text-gray-500">{formatTime(item.decodedAt)}</span>
                <span className="font-mono text-xs text-gray-400">{snrText(item.snr)}</span>
                <span className="font-mono text-gray-200">{item.message}</span>
              </div>
            )) : (
              <p className="px-3 py-6 text-center text-sm text-gray-500">{t('decode.selected.noRelated')}</p>
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

function formatWsjtxStatus(
  status: WsjtxStatus | null,
  isOnSelectedCall: boolean,
  isSendingSelectedCall: boolean,
  t: ReturnType<typeof useLanguage>['t'],
) {
  if (!status) return t('decode.wsjtx.noStatusYet')
  if (status.txWatchdog) return t('decode.wsjtx.watchdogStopped')
  if (isSendingSelectedCall) return t('decode.wsjtx.sendingNow')
  if (isOnSelectedCall && status.txEnabled) return t('decode.wsjtx.readyForTx')
  if (isOnSelectedCall) return t('decode.wsjtx.selected')
  if (status.dxCall) return t('decode.wsjtx.onCall', { callsign: status.dxCall })
  return status.txEnabled ? t('decode.wsjtx.autoTxActive') : t('decode.wsjtx.notInCallMode')
}

function rosterBadgeLabel(key: RosterBadgeKey, t: ReturnType<typeof useLanguage>['t']) {
  return t(`decode.badge.${key}`)
}
