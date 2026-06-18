'use client'
import { useState } from 'react'
import { api } from '@/lib/api'
import { type NotificationItem } from '@/lib/types'
import { type NotificationAction } from '@/components/notifications/NotificationList'
import { useToast } from '@/contexts/ToastContext'

export function useNotificationActions(onDone?: () => Promise<void> | void) {
  const { toast } = useToast()
  const [busyItemId, setBusyItemId] = useState<string | null>(null)

  const runAction = async (item: NotificationItem, action: NotificationAction) => {
    if (item.relatedId == null) return
    setBusyItemId(item.id)
    try {
      if (item.type === 'friend-request') {
        if (action === 'primary') {
          await api.friends.accept(item.relatedId)
          toast('Venneanmodning accepteret')
        } else {
          await api.friends.decline(item.relatedId)
          toast('Venneanmodning afvist')
        }
      } else if (item.type === 'group-invitation') {
        if (action === 'primary') {
          await api.community.acceptGroupInvitation(item.relatedId)
          toast('Gruppeinvitation accepteret')
        } else {
          await api.community.declineGroupInvitation(item.relatedId)
          toast('Gruppeinvitation afvist')
        }
      } else if (item.type === 'group-join-request' && item.groupId != null) {
        if (action === 'primary') {
          await api.community.approveGroupJoinRequest(item.groupId, item.relatedId)
          toast('Join request accepteret')
        } else {
          await api.community.rejectGroupJoinRequest(item.groupId, item.relatedId)
          toast('Join request afvist')
        }
      }
      await api.notifications.markActionHandled({
        type: item.type,
        relatedId: item.relatedId,
        groupId: item.groupId,
      })
      await onDone?.()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Kunne ikke behandle notifikationen', 'error')
    } finally {
      setBusyItemId(null)
    }
  }

  return { busyItemId, runAction }
}
