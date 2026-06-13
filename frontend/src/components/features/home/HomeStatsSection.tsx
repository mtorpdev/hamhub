'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { DashboardStats } from '@/lib/types'

export function HomeStatsSection() {
  const [stats, setStats] = useState<DashboardStats | null>(null)

  useEffect(() => {
    api.admin.stats().then(setStats).catch(() => {})
  }, [])

  const items = [
    { label: 'Brugere', value: stats?.totalUsers ?? '—', icon: '👤' },
    { label: 'QSOer', value: stats?.totalQsos ?? '—', icon: '📻' },
    { label: 'DX Spots', value: stats?.totalDxSpots ?? '—', icon: '📡' },
    { label: 'Artikler', value: stats?.totalArticles ?? '—', icon: '📖' },
  ]

  return (
    <section className="bg-gray-800/50 border-y border-gray-800 py-10 px-4">
      <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
        {items.map(({ label, value, icon }) => (
          <div key={label} className="text-center">
            <div className="text-3xl mb-1">{icon}</div>
            <div className="text-3xl font-bold text-white">{value}</div>
            <div className="text-gray-400 text-sm">{label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
