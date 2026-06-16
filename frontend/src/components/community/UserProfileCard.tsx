'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { api } from '@/lib/api'
import { FriendshipStatus } from '@/lib/types'
import { useToast } from '@/contexts/ToastContext'

export type ProfileCardUser = {
  id: string
  callsign: string | null
  email: string | null
  name: string | null
  gridLocator: string | null
  country: string | null
  isFriend?: boolean
  friendshipStatus?: FriendshipStatus | null
  friendshipDirection?: 'incoming' | 'outgoing' | string | null
}

type Props = {
  user: ProfileCardUser
  incomingRequestId?: number
  onClose: () => void
  onChanged?: () => void
}

export function UserProfileCard({ user, incomingRequestId, onClose, onChanged }: Props) {
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const [reason, setReason] = useState('')
  const [showReport, setShowReport] = useState(false)

  const label = user.callsign || user.name || user.email || 'Ukendt bruger'
  const pending = user.friendshipStatus === FriendshipStatus.Pending

  const run = async (action: () => Promise<void>, success: string) => {
    setBusy(true)
    try {
      await action()
      toast(success)
      onChanged?.()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Handlingen mislykkedes', 'error')
    } finally {
      setBusy(false)
    }
  }

  const report = async () => {
    if (!reason.trim()) return
    await run(
      () => api.safety.report({ targetType: 'user', targetUserId: user.id, reason: reason.trim() }).then(() => undefined),
      'Rapport sendt'
    )
    setReason('')
    setShowReport(false)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-lg border border-gray-700 bg-gray-900 p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-mono text-lg font-bold text-white">{label}</div>
            <div className="mt-1 text-sm text-gray-400">{user.name || user.email || 'HamHub medlem'}</div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-400">
              {user.gridLocator && <span className="rounded bg-gray-800 px-2 py-1 font-mono">{user.gridLocator}</span>}
              {user.country && <span className="rounded bg-gray-800 px-2 py-1">{user.country}</span>}
              {user.isFriend && <span className="rounded bg-blue-500/15 px-2 py-1 text-blue-200">Ven</span>}
              {pending && <span className="rounded bg-yellow-500/10 px-2 py-1 text-yellow-200">Anmodning</span>}
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-white">Luk</button>
        </div>

        <div className="flex flex-wrap gap-2">
          {user.isFriend && (
            <Link href="/messages">
              <Button type="button" size="sm">Send besked</Button>
            </Link>
          )}
          {!user.isFriend && !pending && (
            <Button type="button" size="sm" disabled={busy} onClick={() => run(() => api.friends.sendRequest(user.id).then(() => undefined), 'Venneanmodning sendt')}>
              Tilføj ven
            </Button>
          )}
          {pending && user.friendshipDirection === 'incoming' && incomingRequestId && (
            <Button type="button" size="sm" disabled={busy} onClick={() => run(() => api.friends.accept(incomingRequestId).then(() => undefined), 'Venneanmodning accepteret')}>
              Accepter
            </Button>
          )}
          <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => setShowReport(v => !v)}>
            Rapportér
          </Button>
          <Button type="button" size="sm" variant="danger" disabled={busy} onClick={() => run(() => api.safety.blockUser(user.id), 'Bruger blokeret')}>
            Blokér
          </Button>
        </div>

        {showReport && (
          <div className="mt-4">
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="Hvad skal moderator kigge på?"
              className="w-full resize-none rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
            />
            <div className="mt-2 flex justify-end">
              <Button type="button" size="sm" disabled={busy || !reason.trim()} onClick={report}>Send rapport</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
