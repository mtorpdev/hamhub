'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import type { DashboardStats } from '@/lib/types'

export default function AdminPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)

  useEffect(() => {
    api.admin.dashboard().then(setStats).catch(() => {})
  }, [])

  const cards = stats ? [
    { label: 'Brugere', value: stats.totalUsers, href: '/admin/users', icon: '👤' },
    { label: 'Stationer', value: stats.totalStations, href: '/admin/users', icon: '🗼' },
    { label: 'QSOer', value: stats.totalQsos, href: '#', icon: '📻' },
    { label: 'DX Spots', value: stats.totalDxSpots, href: '/spots', icon: '📡' },
    { label: 'Artikler', value: stats.totalArticles, href: '/admin/articles', icon: '📖' },
  ] : []

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-white mb-8">Admin Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
        {cards.map(({ label, value, href, icon }) => (
          <Link key={label} href={href}>
            <Card className="hover:border-blue-600 transition-colors cursor-pointer">
              <CardContent className="py-5 text-center">
                <div className="text-3xl mb-2">{icon}</div>
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
            <CardHeader><CardTitle>Administrer artikler</CardTitle></CardHeader>
            <CardContent><p className="text-gray-400 text-sm">Opret, rediger og udgiv artikler</p></CardContent>
          </Card>
        </Link>
        <Link href="/admin/users">
          <Card className="hover:border-blue-600 transition-colors cursor-pointer">
            <CardHeader><CardTitle>Administrer brugere</CardTitle></CardHeader>
            <CardContent><p className="text-gray-400 text-sm">Se alle registrerede brugere</p></CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
