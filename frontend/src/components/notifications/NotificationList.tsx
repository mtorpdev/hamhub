'use client'
import Link from 'next/link'
import { type NotificationItem } from '@/lib/types'
import { formatUtcDate } from '@/lib/utils'

export type NotificationAction = 'primary' | 'secondary'

interface NotificationListProps {
  items: NotificationItem[]
  compact?: boolean
  busyItemId?: string | null
  onAction?: (item: NotificationItem, action: NotificationAction) => void
}

function typeLabel(type: string) {
  switch (type) {
    case 'message':
      return 'Besked'
    case 'friend-request':
      return 'Venner'
    case 'group-invitation':
      return 'Gruppe'
    case 'group-join-request':
      return 'Join request'
    default:
      return 'Notifikation'
  }
}

export function NotificationList({ items, compact = false, busyItemId, onAction }: NotificationListProps) {
  if (items.length === 0) {
    return (
      <div className={compact ? 'px-4 py-6 text-center text-sm text-gray-400' : 'rounded-md border border-gray-800 bg-gray-900 px-4 py-8 text-center text-sm text-gray-400'}>
        Ingen nye notifikationer.
      </div>
    )
  }

  return (
    <div className={compact ? 'divide-y divide-gray-800' : 'space-y-3'}>
      {items.map(item => {
        const busy = busyItemId === item.id
        return (
          <div key={item.id} className={compact ? 'px-4 py-3 hover:bg-gray-800/70' : 'rounded-md border border-gray-800 bg-gray-900 p-4'}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="rounded bg-blue-500/15 px-2 py-0.5 text-[11px] font-medium text-blue-300">
                    {typeLabel(item.type)}
                  </span>
                  <span className="text-xs text-gray-500">{formatUtcDate(item.createdAt)}</span>
                </div>
                <Link href={item.href} className="block truncate text-sm font-semibold text-white hover:text-blue-300">
                  {item.title}
                </Link>
                <p className={compact ? 'mt-1 line-clamp-2 text-xs text-gray-400' : 'mt-1 text-sm text-gray-400'}>
                  {item.description}
                </p>
              </div>
            </div>

            {(item.primaryAction || item.secondaryAction) && onAction && (
              <div className="mt-3 flex flex-wrap gap-2">
                {item.primaryAction && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onAction(item, 'primary')}
                    className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {busy ? 'Gemmer...' : item.primaryAction}
                  </button>
                )}
                {item.secondaryAction && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onAction(item, 'secondary')}
                    className="rounded border border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-300 hover:border-gray-500 hover:text-white disabled:opacity-60"
                  >
                    {item.secondaryAction}
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
