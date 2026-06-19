'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/i18n/LanguageContext'
import { viewportShellClass } from '@/lib/layout'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin, isLoading } = useAuth()
  const { t } = useLanguage()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !isAdmin)) {
      router.replace('/login')
    }
  }, [isLoading, isAuthenticated, isAdmin, router])

  if (isLoading) return null

  const links = [
    { href: '/admin', label: t('admin.nav.dashboard') },
    { href: '/admin/articles', label: t('admin.stats.articles') },
    { href: '/admin/users', label: t('admin.stats.users') },
    { href: '/admin/reports', label: t('admin.reports.title') },
  ]

  return (
    <div className="min-h-screen">
      <div className="bg-gray-900 border-b border-yellow-900/40">
        <div className={`${viewportShellClass} flex gap-1 py-2`}>
          {links.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${pathname === l.href ? 'bg-yellow-500/20 text-yellow-300' : 'text-yellow-600 hover:text-yellow-300'}`}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
      {children}
    </div>
  )
}
