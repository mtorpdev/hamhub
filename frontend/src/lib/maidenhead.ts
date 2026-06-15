export function gridToLatLng(grid: string | null | undefined): { lat: number; lng: number } | null {
  if (!grid || grid.trim().length < 4) return null

  const locator = grid.trim().toUpperCase()
  if (locator[0] < 'A' || locator[0] > 'R' || locator[1] < 'A' || locator[1] > 'R') return null
  if (!/\d/.test(locator[2]) || !/\d/.test(locator[3])) return null

  let lng = (locator.charCodeAt(0) - 65) * 20 - 180
  let lat = (locator.charCodeAt(1) - 65) * 10 - 90
  lng += Number(locator[2]) * 2
  lat += Number(locator[3])

  let width = 2
  let height = 1

  if (locator.length >= 6) {
    if (locator[4] < 'A' || locator[4] > 'X' || locator[5] < 'A' || locator[5] > 'X') return null
    width = 2 / 24
    height = 1 / 24
    lng += (locator.charCodeAt(4) - 65) * width
    lat += (locator.charCodeAt(5) - 65) * height
  }

  return { lat: lat + height / 2, lng: lng + width / 2 }
}

export function distanceKm(fromGrid: string | null | undefined, toGrid: string | null | undefined): number | null {
  const from = gridToLatLng(fromGrid)
  const to = gridToLatLng(toGrid)
  if (!from || !to) return null

  const earthRadiusKm = 6371
  const dLat = toRadians(to.lat - from.lat)
  const dLng = toRadians(to.lng - from.lng)
  const fromLat = toRadians(from.lat)
  const toLat = toRadians(to.lat)

  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(fromLat) * Math.cos(toLat) * Math.sin(dLng / 2) ** 2

  return Math.round(earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

function toRadians(value: number) {
  return value * Math.PI / 180
}
