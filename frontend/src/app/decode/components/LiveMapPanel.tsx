'use client'

import { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import LeafletMap, { type MapMarker } from '@/components/ui/Map'
import { gridToLatLng } from '@/lib/maidenhead'
import { snrText } from '../decodeFormatters'
import { type LiveRosterEntry } from '../decodeScoring'

type RosterMapMarker = MapMarker & {
  callsign: string
}

type LiveMapPanelProps = {
  entries: LiveRosterEntry[]
  onSelectCallsign: (callsign: string) => void
}

export default function LiveMapPanel({ entries, onSelectCallsign }: LiveMapPanelProps) {
  const markers = useMemo<RosterMapMarker[]>(() => entries.flatMap(entry => {
    const position = gridToLatLng(entry.latest.dxGrid)
    if (!position) return []

    return [{
      id: entry.callsign,
      callsign: entry.callsign,
      lat: position.lat,
      lng: position.lng,
      label: entry.callsign,
      variant: entry.latest.callsMe ? 'calling-me' : entry.latest.logStatus,
      actionLabel: 'Vælg',
      tooltip: [
        entry.callsign,
        entry.latest.dxGrid ? `Grid ${entry.latest.dxGrid}` : null,
        entry.latest.country !== '-' ? entry.latest.country : null,
        entry.latest.distanceKm ? `${entry.latest.distanceKm.toLocaleString('da-DK')} km` : null,
        `SNR ${snrText(entry.latest.snr)}`,
      ].filter(Boolean).join(' · '),
      popup: `<b>${entry.callsign}</b><br/>${entry.latest.dxGrid ?? '-'}<br/>${entry.latest.country}<br/>SNR ${snrText(entry.latest.snr)}`,
    }]
  }), [entries])

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Kort</h2>
            <p className="mt-1 text-xs text-gray-500">{markers.length} roster stationer med grid</p>
          </div>
        </div>
        {markers.length > 0 ? (
          <LeafletMap markers={markers} height="360px" onMarkerAction={marker => onSelectCallsign((marker as RosterMapMarker).callsign)} />
        ) : (
          <div className="flex h-[360px] items-center justify-center border border-gray-800 bg-gray-950 text-sm text-gray-500">
            Ingen roster stationer med gyldigt grid endnu.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
