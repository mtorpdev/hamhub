'use client'

import { useEffect, useRef } from 'react'
import { gridToLatLng } from '@/lib/maidenhead'

export interface MapMarker {
  id?: string
  lat: number
  lng: number
  label: string
  popup?: string
  tooltip?: string
  variant?: 'worked' | 'new-grid' | 'new-station' | 'unknown'
  actionLabel?: string
}

interface MapProps {
  markers: MapMarker[]
  height?: string
  onMarkerAction?: (marker: MapMarker) => void
}

export { gridToLatLng }

function markerStyle(variant: MapMarker['variant']) {
  if (variant === 'worked') return { color: '#166534', fillColor: '#22c55e' }
  if (variant === 'new-grid') return { color: '#b45309', fillColor: '#f59e0b' }
  if (variant === 'new-station') return { color: '#0369a1', fillColor: '#0ea5e9' }
  return { color: '#475569', fillColor: '#64748b' }
}

export default function Map({ markers, height = '400px', onMarkerAction }: MapProps) {
  const ref = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)
  const markerLayerRef = useRef<import('leaflet').LayerGroup | null>(null)

  useEffect(() => {
    if (!ref.current) return

    let cancelled = false

    import('leaflet').then(L => {
      if (cancelled || !ref.current) return

      if (!mapRef.current) {
        // Fix default marker icon path in Next.js.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (L.Icon.Default.prototype as any)._getIconUrl
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        })

        const center = markers.length > 0
          ? [markers[0].lat, markers[0].lng] as [number, number]
          : [56, 10] as [number, number]

        mapRef.current = L.map(ref.current).setView(center, markers.length === 1 ? 8 : 4)
        markerLayerRef.current = L.layerGroup().addTo(mapRef.current)

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
        }).addTo(mapRef.current)
      }

      const map = mapRef.current
      const layer = markerLayerRef.current
      layer?.clearLayers()

      markers.forEach(markerData => {
        const style = markerStyle(markerData.variant)
        const marker = L.circleMarker([markerData.lat, markerData.lng], {
          radius: 8,
          color: style.color,
          weight: 2,
          fillColor: style.fillColor,
          fillOpacity: 0.92,
          opacity: 1,
          pane: 'markerPane',
        })
        const action = markerData.actionLabel && markerData.id
          ? `<button type="button" class="hamhub-map-popup-action" data-marker-id="${markerData.id}">${markerData.actionLabel}</button>`
          : ''
        marker.bindPopup(`<div class="hamhub-map-popup">${markerData.popup ?? `<b>${markerData.label}</b>`}${action}</div>`)
        if (markerData.tooltip) {
          marker.bindTooltip(markerData.tooltip, {
            direction: 'top',
            offset: [0, -12],
            opacity: 0.96,
            sticky: true,
          })
        }
        marker.on('popupopen', event => {
          const popupElement = event.popup.getElement()
          const actionButton = popupElement?.querySelector<HTMLButtonElement>('[data-marker-id]')
          actionButton?.addEventListener('click', () => onMarkerAction?.(markerData), { once: true })
        })
        marker.addTo(layer ?? map)
      })

      if (markers.length > 1) {
        const bounds = L.latLngBounds(markers.map(marker => [marker.lat, marker.lng] as [number, number]))
        map.fitBounds(bounds, { padding: [40, 40] })
      } else if (markers.length === 1) {
        map.setView([markers[0].lat, markers[0].lng], 8)
      } else {
        map.setView([56, 10], 4)
      }
    })

    return () => {
      cancelled = true
    }
  }, [markers, onMarkerAction])

  useEffect(() => {
    return () => {
      mapRef.current?.remove()
      mapRef.current = null
      markerLayerRef.current = null
    }
  }, [])

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div ref={ref} className="hamhub-leaflet-map" style={{ height, width: '100%', borderRadius: '0.5rem' }} />
    </>
  )
}
