'use client'

import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import Link from 'next/link'
import { type WsjtxStatus } from '@/lib/types'
import { useLanguage } from '@/i18n/LanguageContext'
import { bandModeLabel, formatTime, snrText } from '../decodeFormatters'
import { type LiveRosterEntry, type RosterBadgeKey, type RosterFilters } from '../decodeScoring'

type LiveRosterProps = {
  entries: LiveRosterEntry[]
  selectedCallsign: string
  filters: RosterFilters
  connected: boolean
  wsjtxStatus: WsjtxStatus | null
  agentConnected: boolean
  totalDecodes: number
  onFiltersChange: (filters: RosterFilters) => void
  onSelect: (entry: LiveRosterEntry) => void
  onOpenRaw: () => void
  onStopTx: () => void
  pendingCommand: boolean
  ownCallsign: string
}

export default function LiveRoster({
  entries,
  selectedCallsign,
  filters,
  connected,
  wsjtxStatus,
  agentConnected,
  totalDecodes,
  onFiltersChange,
  onSelect,
  onOpenRaw,
  onStopTx,
  pendingCommand,
  ownCallsign,
}: LiveRosterProps) {
  const { t, language } = useLanguage()
  const wsjtxLabel = !agentConnected
    ? t('decode.wsjtx.noStatus')
    : wsjtxStatus?.transmitting
      ? 'TX'
      : wsjtxStatus?.decoding
        ? 'Decoder'
        : 'Idle'

  const setFilter = <K extends keyof RosterFilters>(key: K, value: RosterFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">{t('decode.roster.title')}</h1>
            <p className="mt-1 text-sm text-gray-400">{t('decode.roster.description')}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="flex items-center gap-1 border border-gray-800 bg-gray-950 px-2 py-1 text-xs text-gray-400">
              <span className={`inline-block h-2 w-2 rounded-full ${connected ? 'animate-pulse bg-green-500' : 'bg-red-500'}`} />
              {t('decode.stream')}: {connected ? t('decode.stream.live') : t('decode.stream.reconnecting')}
            </span>
            <span className="flex items-center gap-1 border border-gray-800 bg-gray-950 px-2 py-1 text-xs text-gray-400">
              <span className={`inline-block h-2 w-2 rounded-full ${agentConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              {t('decode.localAgent')}: {agentConnected ? t('decode.connected') : t('decode.disconnected')}
            </span>
            <span className="border border-gray-800 bg-gray-950 px-2 py-1 text-xs text-gray-400">
              WSJT-X: {wsjtxLabel}
            </span>
            {!agentConnected && (
              <Link href="/profile?tab=agent" className="border border-cyan-800 bg-cyan-950 px-2 py-1 text-xs font-semibold text-cyan-100 hover:bg-cyan-900">
                {t('decode.downloadAgent')}
              </Link>
            )}
            <Badge variant="info">{entries.length}/{totalDecodes}</Badge>
          </div>
        </div>

        <div className="space-y-3 border-y border-gray-800 py-3">
          <div className="flex flex-wrap gap-1">
            {(['all', 'CQ', 'me', '73'] as const).map(value => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter('messageFilter', value)}
                className={`border px-3 py-2 text-xs font-semibold transition-colors ${filters.messageFilter === value ? 'border-cyan-600 bg-cyan-950 text-cyan-100' : 'border-gray-800 bg-gray-950 text-gray-400 hover:border-gray-600 hover:text-gray-200'}`}
              >
                {value === 'all' ? t('decode.filters.all') : value === 'me' ? t('decode.filters.callingMe', { callsign: ownCallsign || t('decode.filters.me') }) : value}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={filters.search}
              onChange={event => setFilter('search', event.target.value)}
              placeholder={t('decode.filters.searchPlaceholder')}
              className="min-w-0 flex-1 border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
            />
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={filters.onlyNeeded}
                onChange={event => setFilter('onlyNeeded', event.target.checked)}
                className="h-4 w-4 accent-cyan-500"
              />
              Needed
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={filters.onlyUnconfirmed}
                onChange={event => setFilter('onlyUnconfirmed', event.target.checked)}
                className="h-4 w-4 accent-cyan-500"
              />
              Unconfirmed
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={filters.onlyWithGrid}
                onChange={event => setFilter('onlyWithGrid', event.target.checked)}
                className="h-4 w-4 accent-cyan-500"
              />
              Grid
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onFiltersChange({ messageFilter: 'all', search: '', onlyNeeded: false, onlyWithGrid: false, onlyUnconfirmed: false })}
              className="border border-gray-700 px-3 py-2 text-xs font-semibold text-gray-300 hover:border-gray-500 hover:text-white"
            >
              {t('decode.filters.clear')}
            </button>
            <button
              type="button"
              onClick={onOpenRaw}
              className="border border-gray-700 px-3 py-2 text-xs font-semibold text-gray-300 hover:border-gray-500 hover:text-white"
            >
              Raw decodes
            </button>
            <button
              type="button"
              onClick={onStopTx}
              disabled={pendingCommand}
              className="ml-auto border border-red-800 bg-red-950 px-3 py-2 text-xs font-semibold text-red-100 hover:bg-red-900 disabled:border-gray-700 disabled:bg-gray-800 disabled:text-gray-500"
            >
              {t('decode.stopCall')}
            </button>
          </div>
        </div>

        <div className="max-h-[72vh] divide-y divide-gray-800 overflow-auto border border-gray-800 bg-black/20">
          {entries.length > 0 ? entries.map(entry => {
            const selected = selectedCallsign === entry.callsign
            return (
              <button
                key={entry.callsign}
                type="button"
                onClick={() => onSelect(entry)}
                className={`grid w-full grid-cols-[84px_1fr_74px] gap-3 px-3 py-3 text-left transition-colors hover:bg-gray-800/60 ${selected ? 'bg-cyan-950/40 ring-1 ring-inset ring-cyan-700' : ''}`}
              >
                <div>
                  <p className="font-mono text-base font-bold text-white">{entry.callsign}</p>
                  <p className="mt-1 font-mono text-xs text-gray-500">{formatTime(entry.latest.decodedAt)}</p>
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-1">
                    {entry.badges.slice(0, 4).map(badge => (
                      <span key={badge.key} className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${badge.className}`}>
                        {rosterBadgeLabel(badge.key, t)}
                      </span>
                    ))}
                  </div>
                  <p className="mt-1 truncate font-mono text-xs text-gray-300">{entry.latest.message}</p>
                  <p className="mt-1 truncate text-xs text-gray-500">
                    {entry.latest.country || '-'} {entry.latest.continent ? `/ ${entry.latest.continent}` : ''} - {entry.latest.dxGrid ?? '-'} - {bandModeLabel(entry.latest)}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-mono text-sm font-bold ${entry.latest.snr >= 0 ? 'text-green-300' : entry.latest.snr >= -10 ? 'text-yellow-300' : 'text-red-300'}`}>
                    {snrText(entry.latest.snr)}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">{entry.latest.distanceKm ? `${entry.latest.distanceKm.toLocaleString(language)} km` : '-'}</p>
                </div>
              </button>
            )
          }) : (
            <div className="px-4 py-12 text-center text-sm text-gray-500">
              {t('decode.roster.noMatches')}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function rosterBadgeLabel(key: RosterBadgeKey, t: ReturnType<typeof useLanguage>['t']) {
  return t(`decode.badge.${key}`)
}
