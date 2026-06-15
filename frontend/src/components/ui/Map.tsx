'use client'
import { useEffect, useRef } from 'react'

interface MapMarker {
  lat: number
  lng: number
  label: string
  popup?: string
}

interface MapProps {
  markers: MapMarker[]
  height?: string
}

// Maidenhead grid square to lat/lng center
export function gridToLatLng(grid: string): { lat: number; lng: number } | null {
  if (!grid || grid.length < 4) return null
  const g = grid.toUpperCase()
  const lng = (g.charCodeAt(0) - 65) * 20 - 180 + (parseInt(g[2]) * 2) + 1
  const lat = (g.charCodeAt(1) - 65) * 10 - 90 + parseInt(g[3]) + 0.5
  return { lat, lng }
}

export default function Map({ markers, height = '400px' }: MapProps) {
  const ref = useRef<HTMLDivElement>(null)
  const mapRef = useRef<unknown>(null)

  useEffect(() => {
    if (!ref.current || mapRef.current) return
    if (markers.length === 0) return

    let cancelled = false

    import('leaflet').then(L => {
      if (cancelled || !ref.current || mapRef.current) return

      // Fix default marker icon path in Next.js
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

      const map = L.map(ref.current).setView(center, markers.length === 1 ? 8 : 4)
      mapRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map)

      markers.forEach(m => {
        const marker = L.marker([m.lat, m.lng]).addTo(map)
        if (m.popup) marker.bindPopup(m.popup)
        else marker.bindPopup(`<b>${m.label}</b>`)
      })

      if (markers.length > 1) {
        const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng] as [number, number]))
        map.fitBounds(bounds, { padding: [40, 40] })
      }
    })

    return () => {
      cancelled = true
      if (mapRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mapRef.current as any).remove()
        mapRef.current = null
      }
    }
  }, [markers])

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div ref={ref} style={{ height, width: '100%', borderRadius: '0.5rem' }} />
    </>
  )
}
