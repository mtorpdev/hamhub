'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import type { User } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { useLanguage } from '@/i18n/LanguageContext'
import { pageShellClass } from '@/lib/layout'

export default function AdminUsersPage() {
  const { t } = useLanguage()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.users.getAll().then(setUsers).finally(() => setLoading(false))
  }, [])

  const headers = [
    t('admin.users.callsign'),
    t('admin.users.name'),
    t('admin.users.email'),
    t('admin.users.country'),
    t('admin.users.grid'),
    t('admin.users.created'),
  ]

  return (
    <div className={pageShellClass}>
      <h1 className="text-3xl font-bold text-white mb-8">{t('admin.users.title', { count: users.length })}</h1>
      <Card>
        <CardContent className="p-0">
          {loading ? <p className="p-6 text-gray-400">{t('common.loading')}</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-800/50">
                  <tr>
                    {headers.map((header) => (
                      <th key={header} className="px-4 py-3 text-left text-gray-400 font-medium">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-white">{user.callsign || '-'}</td>
                      <td className="px-4 py-3 text-gray-300">{user.firstName} {user.lastName}</td>
                      <td className="px-4 py-3 text-gray-400">{user.email}</td>
                      <td className="px-4 py-3 text-gray-400">{user.country || '-'}</td>
                      <td className="px-4 py-3 font-mono text-gray-400">{user.gridLocator || '-'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(user.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
