'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import { api } from '@/lib/api'
import { pageShellClass } from '@/lib/layout'
import { type NotificationCenter } from '@/lib/types'
import { NotificationList } from '@/components/notifications/NotificationList'
import { useNotificationActions } from '@/hooks/useNotificationActions'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.hamhub.dk'
const emptyCenter: NotificationCenter = {
  summary: {
    unreadMessages: 0,
    incomingFriendRequests: 0,
    groupInvitations: 0,
    groupJoinRequests: 0,
    total: 0,
  },
  items: [],
}

export default function NotificationsPage() {
  useRequireAuth()
  const { user } = useAuth()
  const [center, setCenter] = useState<NotificationCenter>(emptyCenter)
  const [loading, setLoading] = useState(true)

  const loadCenter = useCallback(async () => {
    setLoading(true)
    try {
      setCenter(await api.notifications.center())
    } finally {
      setLoading(false)
    }
  }, [])
  const { busyItemId, runAction } = useNotificationActions(loadCenter)

  useEffect(() => {
    void Promise.resolve().then(loadCenter)
  }, [loadCenter])

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    if (!token || !user?.id) return

    const connection = new HubConnectionBuilder()
      .withUrl(`${API_URL}/hubs/private-messages`, { accessTokenFactory: () => token })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build()

    connection.on('PrivateMessageCreated', loadCenter)
    connection.on('FriendshipChanged', loadCenter)
    connection.on('NotificationSummaryChanged', loadCenter)

    connection.start().catch(() => undefined)
    return () => { void connection.stop().catch(() => undefined) }
  }, [loadCenter, user?.id])

  const summaryCards = [
    ['Beskeder', center.summary.unreadMessages, '/messages'],
    ['Venner', center.summary.incomingFriendRequests, '/messages?tab=requests'],
    ['Invitationer', center.summary.groupInvitations, '/community'],
    ['Join requests', center.summary.groupJoinRequests, '/community'],
  ] as const

  return (
    <div className={pageShellClass}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white">Notifikationer</h1>
          <p className="mt-1 text-sm text-gray-500">Samlet overblik over beskeder, venner og gruppehandlinger.</p>
        </div>
        <Button type="button" variant="secondary" onClick={loadCenter} disabled={loading}>
          {loading ? 'Henter...' : 'Opdater'}
        </Button>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map(([label, count, href]) => (
          <Link key={label} href={href} className="rounded-md border border-gray-800 bg-gray-900 p-4 hover:border-gray-700">
            <p className="text-sm text-gray-400">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{count}</p>
          </Link>
        ))}
      </div>

      {loading && center.items.length === 0 ? (
        <div className="rounded-md border border-gray-800 bg-gray-900 px-4 py-8 text-center text-sm text-gray-400">
          Henter notifikationer...
        </div>
      ) : (
        <NotificationList
          items={center.items}
          busyItemId={busyItemId}
          onAction={runAction}
        />
      )}
    </div>
  )
}
