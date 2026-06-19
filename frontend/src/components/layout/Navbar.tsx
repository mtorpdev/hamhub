'use client'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import { api } from '@/lib/api'
import { type NotificationCenter, type NotificationSummary } from '@/lib/types'
import { viewportShellClass } from '@/lib/layout'
import { NotificationList } from '@/components/notifications/NotificationList'
import { useNotificationActions } from '@/hooks/useNotificationActions'
import { HamHubLogo } from '@/components/brand/HamHubLogo'
import { LanguageSwitcher } from '@/i18n/LanguageSwitcher'
import { useLanguage } from '@/i18n/LanguageContext'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.hamhub.dk'
const emptySummary: NotificationSummary = {
  unreadMessages: 0,
  incomingFriendRequests: 0,
  groupInvitations: 0,
  groupJoinRequests: 0,
  total: 0,
}
const emptyCenter: NotificationCenter = { summary: emptySummary, history: { unreadCount: 0, items: [] }, items: [] }

function Badge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-semibold text-white">
      {count > 99 ? '99+' : count}
    </span>
  )
}

function BellIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14.8 17.5a3 3 0 0 1-5.6 0M18 9.8c0-3.1-2.1-5.6-5-6.2V3a1 1 0 1 0-2 0v.6c-2.9.6-5 3.1-5 6.2v2.7c0 .7-.3 1.4-.8 1.9L4 15.6v1.1h16v-1.1l-1.2-1.2c-.5-.5-.8-1.2-.8-1.9V9.8Z" />
    </svg>
  )
}

export function Navbar() {
  const { isAuthenticated, user, logout, isAdmin } = useAuth()
  const { t } = useLanguage()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [summary, setSummary] = useState<NotificationSummary>(emptySummary)
  const [center, setCenter] = useState<NotificationCenter>(emptyCenter)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const desktopNotificationRef = useRef<HTMLDivElement | null>(null)
  const mobileNotificationRef = useRef<HTMLDivElement | null>(null)
  const homeHref = isAuthenticated ? '/dashboard' : '/'

  const loadSummary = useCallback(async () => {
    if (!isAuthenticated) {
      setSummary(emptySummary)
      return
    }

    try {
      setSummary(await api.notifications.summary())
    } catch {
      setSummary(emptySummary)
    }
  }, [isAuthenticated])

  const loadCenter = useCallback(async () => {
    if (!isAuthenticated) {
      setCenter(emptyCenter)
      setSummary(emptySummary)
      return
    }

    setNotificationsLoading(true)
    try {
      const data = await api.notifications.center()
      setCenter(data)
      setSummary(data.summary)
    } catch {
      setCenter(emptyCenter)
    } finally {
      setNotificationsLoading(false)
    }
  }, [isAuthenticated])

  const { busyItemId, runAction } = useNotificationActions(loadCenter)

  useEffect(() => {
    void Promise.resolve().then(loadSummary)
  }, [loadSummary])

  useEffect(() => {
    if (!isAuthenticated) return
    const timer = window.setInterval(loadSummary, 30_000)
    return () => window.clearInterval(timer)
  }, [isAuthenticated, loadSummary])

  useEffect(() => {
    if (!notificationsOpen) return
    void Promise.resolve().then(loadCenter)
  }, [notificationsOpen, loadCenter])

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node
      const insideDesktop = desktopNotificationRef.current?.contains(target)
      const insideMobile = mobileNotificationRef.current?.contains(target)
      if (!insideDesktop && !insideMobile) setNotificationsOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    if (!token) return

    let stopped = false
    const connection = new HubConnectionBuilder()
      .withUrl(`${API_URL}/hubs/private-messages`, { accessTokenFactory: () => token })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build()

    connection.on('PrivateMessageCreated', loadSummary)
    connection.on('FriendshipChanged', loadSummary)
    connection.on('NotificationSummaryChanged', loadSummary)

    connection.start().catch(() => undefined)

    return () => {
      stopped = true
      if (stopped) void connection.stop().catch(() => undefined)
    }
  }, [isAuthenticated, loadSummary])

  const handleLogout = () => {
    logout()
    setSummary(emptySummary)
    setCenter(emptyCenter)
    setNotificationsOpen(false)
    router.push('/')
  }

  const renderNotificationBell = (ref: RefObject<HTMLDivElement | null>) => isAuthenticated ? (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={t('nav.notifications')}
        onClick={() => setNotificationsOpen(open => !open)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white"
      >
        <BellIcon />
        <span className="sr-only">{t('nav.notifications')}</span>
        {summary.total > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-semibold text-white">
            {summary.total > 99 ? '99+' : summary.total}
          </span>
        )}
      </button>

      {notificationsOpen && (
        <div className="absolute right-0 top-11 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-md border border-gray-700 bg-gray-900 shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-white">{t('notifications.title')}</p>
              <p className="text-xs text-gray-500">
                {t('notifications.actions', { count: summary.total })}
                {center.history.unreadCount > 0 ? ` · ${center.history.unreadCount} ulæst i historik` : ''}
              </p>
            </div>
            <Link href="/notifications" onClick={() => setNotificationsOpen(false)} className="text-xs font-medium text-blue-300 hover:text-blue-200">
              {t('notifications.viewAll')}
            </Link>
          </div>
          {notificationsLoading ? (
            <div className="px-4 py-6 text-center text-sm text-gray-400">{t('common.loading')}</div>
          ) : (
            <div className="max-h-[28rem] overflow-y-auto">
              <NotificationList
                compact
                items={center.items.slice(0, 8)}
                busyItemId={busyItemId}
                onAction={runAction}
              />
            </div>
          )}
        </div>
      )}
    </div>
  ) : null

  return (
    <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
      <div className={viewportShellClass}>
        <div className="flex items-center justify-between h-16">
          <Link href={homeHref} className="flex items-center gap-2">
            <HamHubLogo />
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <Link href="/spots" className="text-gray-300 hover:text-white text-sm">{t('nav.dxSpots')}</Link>
            <Link href="/pota" className="text-gray-300 hover:text-white text-sm">{t('nav.pota')}</Link>
            <Link href="/forum" className="text-gray-300 hover:text-white text-sm">{t('nav.forum')}</Link>
            <Link href="/articles" className="text-gray-300 hover:text-white text-sm">{t('nav.articles')}</Link>
            <Link href="/marketplace" className="text-gray-300 hover:text-white text-sm">{t('nav.marketplace')}</Link>
            {isAuthenticated && <>
              <Link href="/decode" className="text-gray-300 hover:text-white text-sm">{t('nav.liveRoster')}</Link>
              <Link href="/awards" className="text-gray-300 hover:text-white text-sm">{t('nav.awards')}</Link>
              <Link href="/community" className="text-gray-300 hover:text-white text-sm">{t('nav.groups')}</Link>
              <Link href="/dashboard" className="text-gray-300 hover:text-white text-sm">{t('nav.dashboard')}</Link>
              <Link href="/logbook" className="text-gray-300 hover:text-white text-sm">{t('nav.logbook')}</Link>
              <Link href="/messages" className="text-gray-300 hover:text-white text-sm">{t('nav.messages')}</Link>
              {isAdmin && <Link href="/admin" className="text-yellow-400 hover:text-yellow-300 text-sm font-medium">{t('nav.admin')}</Link>}
            </>}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <LanguageSwitcher compact />
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                {renderNotificationBell(desktopNotificationRef)}
                <Link href="/profile" className="text-sm text-gray-300 hover:text-white">
                  {user?.callsign || user?.email}
                </Link>
                <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded border border-gray-700 hover:border-gray-500 transition-colors">
                  {t('nav.logout')}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login" className="text-sm text-gray-300 hover:text-white px-3 py-1.5">{t('nav.login')}</Link>
                <Link href="/register" className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded hover:bg-blue-700">{t('nav.register')}</Link>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <LanguageSwitcher compact />
            {renderNotificationBell(mobileNotificationRef)}
            <button className="text-gray-400 hover:text-white" onClick={() => setMenuOpen(!menuOpen)}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={menuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden py-3 border-t border-gray-800 flex flex-col gap-3">
            <Link href="/spots" className="text-gray-300 text-sm py-1">{t('nav.dxSpots')}</Link>
            <Link href="/pota" className="text-gray-300 text-sm py-1">{t('nav.pota')}</Link>
            <Link href="/forum" className="text-gray-300 text-sm py-1">{t('nav.forum')}</Link>
            <Link href="/articles" className="text-gray-300 text-sm py-1">{t('nav.articles')}</Link>
            <Link href="/marketplace" className="text-gray-300 text-sm py-1">{t('nav.marketplace')}</Link>
            {isAuthenticated ? <>
              <Link href="/decode" className="text-gray-300 text-sm py-1">{t('nav.liveRoster')}</Link>
              <Link href="/awards" className="text-gray-300 text-sm py-1">{t('nav.awards')}</Link>
              <Link href="/community" className="text-gray-300 text-sm py-1">{t('nav.groups')}</Link>
              <Link href="/dashboard" className="text-gray-300 text-sm py-1">{t('nav.dashboard')}</Link>
              <Link href="/logbook" className="text-gray-300 text-sm py-1">{t('nav.logbook')}</Link>
              <Link href="/messages" className="text-gray-300 text-sm py-1">{t('nav.messages')}</Link>
              <Link href="/notifications" className="text-gray-300 text-sm py-1">{t('nav.notifications')}<Badge count={summary.total} /></Link>
              {isAdmin && <Link href="/admin" className="text-yellow-400 text-sm py-1">{t('nav.admin')}</Link>}
              <button onClick={handleLogout} className="text-gray-300 text-sm py-1 text-left">{t('nav.logout')}</button>
            </> : <>
              <Link href="/login" className="text-gray-300 text-sm py-1">{t('nav.login')}</Link>
              <Link href="/register" className="text-blue-400 text-sm py-1">{t('nav.register')}</Link>
            </>}
          </div>
        )}
      </div>
    </nav>
  )
}
