'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { DashboardStats } from '@/lib/types'
import { useLanguage } from '@/i18n/LanguageContext'

export function HomeStatsSection() {
  const { t } = useLanguage()
  const [stats, setStats] = useState<DashboardStats | null>(null)

  useEffect(() => {
    api.admin.stats().then(setStats).catch(() => {})
  }, [])

  const items = [
    { label: t('home.stats.users'), value: stats?.totalUsers ?? '-', icon: 'Users' },
    { label: t('home.stats.qsos'), value: stats?.totalQsos ?? '-', icon: 'QSO' },
    { label: t('home.stats.dxSpots'), value: stats?.totalDxSpots ?? '-', icon: 'DX' },
    { label: t('home.stats.articles'), value: stats?.totalArticles ?? '-', icon: 'News' },
  ]

  return (
    <section className="bg-gray-800/50 border-y border-gray-800 py-10 px-4">
      <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
        {items.map(({ label, value, icon }) => (
          <div key={label} className="text-center">
            <div className="mb-1 text-sm font-semibold uppercase tracking-wide text-blue-300">{icon}</div>
            <div className="text-3xl font-bold text-white">{value}</div>
            <div className="text-gray-400 text-sm">{label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
