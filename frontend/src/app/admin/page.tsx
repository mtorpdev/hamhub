'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useLanguage } from '@/i18n/LanguageContext'
import type { DashboardStats } from '@/lib/types'
import { pageShellClass } from '@/lib/layout'

export default function AdminPage() {
  const { t } = useLanguage()
  const [stats, setStats] = useState<DashboardStats | null>(null)

  useEffect(() => {
    api.admin.dashboard().then(setStats).catch(() => {})
  }, [])

  const cards = stats ? [
    { label: t('admin.stats.users'), value: stats.totalUsers, href: '/admin/users', icon: 'U' },
    { label: t('admin.stats.stations'), value: stats.totalStations, href: '/admin/users', icon: 'S' },
    { label: t('admin.stats.qsos'), value: stats.totalQsos, href: '#', icon: 'Q' },
    { label: t('admin.stats.dxSpots'), value: stats.totalDxSpots, href: '/spots', icon: 'DX' },
    { label: t('admin.stats.articles'), value: stats.totalArticles, href: '/admin/articles', icon: 'A' },
  ] : []

  return (
    <div className={pageShellClass}>
      <h1 className="text-3xl font-bold text-white mb-8">{t('admin.title')}</h1>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
        {cards.map(({ label, value, href, icon }) => (
          <Link key={label} href={href}>
            <Card className="hover:border-blue-600 transition-colors cursor-pointer">
              <CardContent className="py-5 text-center">
                <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-blue-950 text-sm font-semibold text-blue-200">{icon}</div>
                <div className="text-2xl font-bold text-white">{value}</div>
                <p className="text-gray-400 text-xs mt-1">{label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Link href="/admin/articles">
          <Card className="hover:border-blue-600 transition-colors cursor-pointer">
            <CardHeader><CardTitle>{t('admin.manageArticles')}</CardTitle></CardHeader>
            <CardContent><p className="text-gray-400 text-sm">{t('admin.manageArticlesDescription')}</p></CardContent>
          </Card>
        </Link>
        <Link href="/admin/users">
          <Card className="hover:border-blue-600 transition-colors cursor-pointer">
            <CardHeader><CardTitle>{t('admin.manageUsers')}</CardTitle></CardHeader>
            <CardContent><p className="text-gray-400 text-sm">{t('admin.manageUsersDescription')}</p></CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
