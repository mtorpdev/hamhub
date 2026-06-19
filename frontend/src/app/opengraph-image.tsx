import { ImageResponse } from 'next/og'
import { siteConfig } from '@/lib/seo'

export const runtime = 'edge'
export const alt = 'HamHub amateur radio logbook, DX spots, POTA and community platform'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#07111f',
          color: '#f8fafc',
          padding: 72,
          fontFamily: 'Arial, Helvetica, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <div
            style={{
              width: 82,
              height: 82,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 18,
              background: '#0f172a',
              border: '2px solid #38bdf8',
              color: '#38bdf8',
              fontSize: 40,
              fontWeight: 800,
            }}
          >
            H
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 46, fontWeight: 800 }}>{siteConfig.name}</div>
            <div style={{ fontSize: 24, color: '#93c5fd' }}>Amateur radio, connected</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div style={{ maxWidth: 920, fontSize: 64, lineHeight: 1.05, fontWeight: 800 }}>
            Log QSOs, track awards and follow live radio activity
          </div>
          <div style={{ maxWidth: 940, fontSize: 28, lineHeight: 1.35, color: '#cbd5e1' }}>
            DX spots, POTA, QRZ, LoTW, eQSL, stations, groups, forum and marketplace in one web platform.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 18, fontSize: 22, color: '#d1fae5' }}>
          <span>QSO Logbook</span>
          <span>DX Spots</span>
          <span>POTA</span>
          <span>Awards</span>
          <span>Community</span>
        </div>
      </div>
    ),
    size
  )
}
