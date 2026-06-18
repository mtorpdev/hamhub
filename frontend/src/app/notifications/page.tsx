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
import { formatUtcDate } from '@/lib/utils'
import { useToast } from '@/contexts/ToastContext'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.hamhub.dk'
const emptyCenter: NotificationCenter = {
  summary: {
    unreadMessages: 0,
    incomingFriendRequests: 0,
    groupInvitations: 0,
    groupJoinRequests: 0,
    total: 0,
  },
  history: {
    unreadCount: 0,
    items: [],
  },
  items: [],
}

export default function NotificationsPage() {
  useRequireAuth()
  const { user } = useAuth()
  const { toast } = useToast()
  const [center, setCenter] = useState<NotificationCenter>(emptyCenter)
  const [loading, setLoading] = useState(true)
  const [markingRead, setMarkingRead] = useState(false)

  const loadCenter = useCallback(async () => {
    setLoading(true)
    try {
      setCenter(await api.notifications.center())
    } finally {
      setLoading(false)
    }
  }, [])
  const { busyItemId, runAction } = useNotificationActions(loadCenter)

  const markHistoryRead = async () => {
    setMarkingRead(true)
    try {
      await api.notifications.markHistoryRead()
      toast('Notifikationshistorik markeret som læst')
      await loadCenter()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Kunne ikke markere historik som læst', 'error')
    } finally {
      setMarkingRead(false)
    }
  }

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

      <div className="mt-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white">Historik</h2>
            <p className="mt-1 text-sm text-gray-500">{center.history.unreadCount} ulæste historik-events</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={markHistoryRead}
            disabled={markingRead || center.history.unreadCount === 0}
          >
            {markingRead ? 'Gemmer...' : 'Marker alle som læst'}
          </Button>
        </div>

        {center.history.items.length === 0 ? (
          <div className="rounded-md border border-gray-800 bg-gray-900 px-4 py-8 text-center text-sm text-gray-400">
            Ingen historik endnu.
          </div>
        ) : (
          <div className="space-y-3">
            {center.history.items.map(item => (
              <a
                key={item.id}
                href={item.href}
                className={`block rounded-md border p-4 ${item.isRead ? 'border-gray-800 bg-gray-900/70' : 'border-blue-500/40 bg-blue-500/10'}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <span className="text-xs text-gray-500">{formatUtcDate(item.createdAt)}</span>
                </div>
                <p className="mt-1 text-sm text-gray-400">{item.description}</p>
                <p className="mt-2 text-xs font-medium text-blue-300">{item.isRead ? 'Læst' : 'Ulæst'}</p>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
