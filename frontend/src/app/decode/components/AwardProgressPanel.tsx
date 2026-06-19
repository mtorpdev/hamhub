'use client'

import { Card, CardContent } from '@/components/ui/Card'
import { useLanguage } from '@/i18n/LanguageContext'
import { bandModeLabel, snrText } from '../decodeFormatters'
import { type AwardSummary, type LiveRosterEntry } from '../decodeScoring'

type AwardProgressPanelProps = {
  summary: AwardSummary
  onSelect: (entry: LiveRosterEntry) => void
}

export default function AwardProgressPanel({ summary, onSelect }: AwardProgressPanelProps) {
  const { t } = useLanguage()
  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div>
          <h2 className="text-sm font-semibold text-white">{t('decode.awards.title')}</h2>
          <p className="mt-1 text-xs text-gray-500">{t('decode.awards.description')}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Stat label={t('decode.awards.newDxcc')} value={summary.liveNeededDxcc} />
          <Stat label={t('decode.awards.dxccQsl')} value={summary.liveDxccNeedQsl} />
          <Stat label={t('decode.awards.continents')} value={summary.liveNeededContinents} />
          <Stat label={t('decode.awards.grids')} value={summary.liveNeededGrids} />
          <Stat label="WPX" value={summary.liveNeededWpx} />
          <Stat label={t('decode.awards.dxccBand')} value={summary.liveNeededDxccBands} />
          <Stat label={t('decode.awards.dxccMode')} value={summary.liveNeededDxccModes} />
          <Stat label={t('decode.awards.callBandMode')} value={summary.liveNeededBandModes} />
          <Stat label={t('decode.awards.workedDxcc')} value={summary.workedCountries} muted />
          <Stat label={t('decode.awards.confirmedDxcc')} value={summary.confirmedCountries} muted />
        </div>

        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {summary.continents.map(item => (
            <div
              key={item.code}
              className={`border px-2 py-2 text-center ${item.liveNeeded ? 'border-red-800 bg-red-950/40' : item.worked ? 'border-green-800 bg-green-950/30' : item.liveCount > 0 ? 'border-amber-700 bg-amber-950/30' : 'border-gray-800 bg-gray-900/50'}`}
              title={item.label}
            >
              <p className="font-mono text-sm font-bold text-white">{item.code}</p>
          <p className="text-[10px] text-gray-500">{t('decode.awards.liveCount', { count: item.liveCount })}</p>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase text-gray-500">{t('decode.awards.bestOpportunities')}</p>
          {summary.opportunities.length > 0 ? summary.opportunities.map(entry => (
            <button
              key={entry.callsign}
              type="button"
              onClick={() => onSelect(entry)}
              className="grid w-full grid-cols-[82px_1fr_52px] gap-2 border border-gray-800 bg-gray-950 px-3 py-2 text-left text-xs transition-colors hover:border-gray-600"
            >
              <span className="font-mono font-bold text-white">{entry.callsign}</span>
              <span className="truncate text-gray-400">{entry.latest.country} / {bandModeLabel(entry.latest)}</span>
              <span className="text-right font-mono text-gray-300">{snrText(entry.latest.snr)}</span>
            </button>
          )) : (
            <p className="border border-gray-800 bg-gray-950 px-3 py-6 text-center text-xs text-gray-500">
              {t('decode.awards.noNeededHits')}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function Stat({ label, value, muted = false }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className={`border px-3 py-2 ${muted ? 'border-gray-800 bg-gray-900/40 text-gray-300' : 'border-cyan-800 bg-cyan-950/30 text-cyan-100'}`}>
      <p className="text-[10px] uppercase opacity-70">{label}</p>
      <p className="mt-1 font-mono text-lg font-bold">{value}</p>
    </div>
  )
}
