'use client'

import { useEffect, useRef } from 'react'
import { gridToLatLng } from '@/lib/maidenhead'

export interface MapMarker {
  id?: string
  lat: number
  lng: number
  label: string
  popup?: string
}

interface MapProps {
  markers: MapMarker[]
  height?: string
  onMarkerClick?: (marker: MapMarker) => void
}

export { gridToLatLng }

export default function Map({ markers, height = '400px', onMarkerClick }: MapProps) {
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
        const marker = L.marker([markerData.lat, markerData.lng])
        marker.bindPopup(markerData.popup ?? `<b>${markerData.label}</b>`)
        if (onMarkerClick) marker.on('click', () => onMarkerClick(markerData))
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
  }, [markers, onMarkerClick])

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
      <div ref={ref} style={{ height, width: '100%', borderRadius: '0.5rem' }} />
    </>
  )
}
