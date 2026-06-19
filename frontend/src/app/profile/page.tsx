'use client'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ProfileVisibility, type BlockedUser, type EqslStatus, type Friendship, type LotwStatus, type QrzStatus, type Station } from '@/lib/types'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useToast } from '@/contexts/ToastContext'
import { pageShellClass } from '@/lib/layout'
import { stationOptionLabel } from '@/app/logbook/stationGrid'
import { LanguageSwitcher } from '@/i18n/LanguageSwitcher'
import { useLanguage } from '@/i18n/LanguageContext'
import { formatDateTime } from '@/i18n/format'

export default function ProfilePage() {
  const { user } = useAuth()
  useRequireAuth()
  const { toast } = useToast()
  const { t, language } = useLanguage()
  const [activeTab, setActiveTab] = useState<'profile' | 'integrations' | 'agent' | 'friends' | 'blocks'>(() => {
    if (typeof window === 'undefined') return 'profile'
    const tab = new URLSearchParams(window.location.search).get('tab')
    return tab === 'agent' || tab === 'apps' ? 'agent' : 'profile'
  })
  const [form, setForm] = useState({ callsign: '', firstName: '', lastName: '', country: '', gridLocator: '', defaultStationId: '', profileDescription: '', visibility: ProfileVisibility.Public })
  const [loading, setLoading] = useState(false)
  const [stations, setStations] = useState<Station[]>([])
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [qrzKey, setQrzKey] = useState('')
  const [qrzStatus, setQrzStatus] = useState<QrzStatus | null>(null)
  const [qrzLoading, setQrzLoading] = useState(false)
  const [qrzSyncing, setQrzSyncing] = useState(false)
  const [qrzXmlUsername, setQrzXmlUsername] = useState('')
  const [qrzXmlPassword, setQrzXmlPassword] = useState('')
  const [qrzXmlLoading, setQrzXmlLoading] = useState(false)
  const [eqslStatus, setEqslStatus] = useState<EqslStatus | null>(null)
  const [eqslUsername, setEqslUsername] = useState('')
  const [eqslPassword, setEqslPassword] = useState('')
  const [eqslQthNickname, setEqslQthNickname] = useState('')
  const [eqslLoading, setEqslLoading] = useState(false)
  const [lotwStatus, setLotwStatus] = useState<LotwStatus | null>(null)
  const [lotwUsername, setLotwUsername] = useState('')
  const [lotwPassword, setLotwPassword] = useState('')
  const [lotwLoading, setLotwLoading] = useState(false)
  const [lotwSyncing, setLotwSyncing] = useState(false)
  const [friends, setFriends] = useState<Friendship[]>([])
  const [friendsLoading, setFriendsLoading] = useState(false)
  const [removingFriendId, setRemovingFriendId] = useState<string | null>(null)
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([])
  const [blocksLoading, setBlocksLoading] = useState(false)
  const [unblockingUserId, setUnblockingUserId] = useState<string | null>(null)

  const loadFriends = useCallback(async () => {
    setFriendsLoading(true)
    try {
      setFriends(await api.friends.getAll())
    } catch (err) {
      toast(err instanceof Error ? err.message : t('profile.friends.loadFailed'), 'error')
    } finally {
      setFriendsLoading(false)
    }
  }, [toast])

  const loadBlockedUsers = useCallback(async () => {
    setBlocksLoading(true)
    try {
      setBlockedUsers(await api.safety.getBlockedUsers())
    } catch (err) {
      toast(err instanceof Error ? err.message : t('profile.blocks.loadFailed'), 'error')
    } finally {
      setBlocksLoading(false)
    }
  }, [toast])

  useEffect(() => {
    let cancelled = false

    async function loadProfileState() {
      await Promise.resolve()
      if (cancelled) return

      if (user) setForm({
        callsign: user.callsign || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        country: user.country || '',
        gridLocator: user.gridLocator || '',
        defaultStationId: user.defaultStationId?.toString() ?? '',
        profileDescription: user.profileDescription || '',
        visibility: user.visibility,
      })

      api.qrz.status().then(status => {
        if (!cancelled) setQrzStatus(status)
      }).catch(() => {})
      api.eqsl.status().then(status => {
        if (!cancelled) setEqslStatus(status)
      }).catch(() => {})
      api.lotw.status().then(status => {
        if (!cancelled) setLotwStatus(status)
      }).catch(() => {})
      api.friends.getAll().then(items => {
        if (!cancelled) setFriends(items)
      }).catch(() => {})
      api.safety.getBlockedUsers().then(items => {
        if (!cancelled) setBlockedUsers(items)
      }).catch(() => {})
      api.stations.getMine().then(items => {
        if (!cancelled) setStations(items)
      }).catch(() => {})
    }

    loadProfileState()
    return () => { cancelled = true }
  }, [user])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const setPassword = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setPasswordForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.users.updateMe({
        ...form,
        visibility: Number(form.visibility),
        defaultStationId: form.defaultStationId ? Number(form.defaultStationId) : null,
      } as never)
      toast(t('profile.saved'))
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast(t('profile.passwordMismatch'), 'error')
      return
    }

    setPasswordLoading(true)
    try {
      await api.users.changePassword(passwordForm)
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      toast(t('profile.passwordUpdated'))
    } catch (err) {
      toast(err instanceof Error ? err.message : t('profile.passwordUpdateFailed'), 'error')
    } finally {
      setPasswordLoading(false)
    }
  }

  const handleSaveQrzKey = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!qrzKey.trim()) return
    setQrzLoading(true)
    try {
      await api.qrz.saveKey(qrzKey.trim())
      toast(t('profile.qrzKeySaved'))
      setQrzKey('')
      const status = await api.qrz.status()
      setQrzStatus(status)
    } catch (err) {
      toast(err instanceof Error ? err.message : t('profile.qrzKeySaveFailed'), 'error')
    } finally {
      setQrzLoading(false)
    }
  }

  const handleSaveQrzCredentials = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!qrzXmlUsername.trim() || !qrzXmlPassword) return
    setQrzXmlLoading(true)
    try {
      await api.qrz.saveCredentials(qrzXmlUsername.trim(), qrzXmlPassword)
      toast(t('profile.qrzCredentialsSaved'))
      setQrzXmlUsername('')
      setQrzXmlPassword('')
      const status = await api.qrz.status()
      setQrzStatus(status)
    } catch (err) {
      toast(err instanceof Error ? err.message : t('profile.qrzCredentialsSaveFailed'), 'error')
    } finally {
      setQrzXmlLoading(false)
    }
  }

  const handleQrzSync = async () => {
    setQrzSyncing(true)
    try {
      await api.qrz.sync()
      // Poll for completion (up to 30s)
      const deadline = Date.now() + 30_000
      const prevSyncedAt = qrzStatus?.lastSyncedAt
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 2000))
        const status = await api.qrz.status()
        setQrzStatus(status)
        if (status.lastSyncedAt !== prevSyncedAt) break
      }
      toast(t('profile.qrzSyncComplete'))
    } catch (err) {
      toast(err instanceof Error ? err.message : t('profile.syncFailed'), 'error')
    } finally {
      setQrzSyncing(false)
    }
  }

  const handleSaveEqslCredentials = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!eqslUsername.trim() || !eqslPassword) return
    setEqslLoading(true)
    try {
      await api.eqsl.saveCredentials(eqslUsername.trim(), eqslPassword, eqslQthNickname.trim() || undefined)
      toast(t('profile.eqslSaved'))
      setEqslUsername('')
      setEqslPassword('')
      setEqslQthNickname('')
      setEqslStatus(await api.eqsl.status())
    } catch (err) {
      toast(err instanceof Error ? err.message : t('profile.eqslSaveFailed'), 'error')
    } finally {
      setEqslLoading(false)
    }
  }

  const handleSaveLotwCredentials = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!lotwUsername.trim() || !lotwPassword) return
    setLotwLoading(true)
    try {
      await api.lotw.saveCredentials(lotwUsername.trim(), lotwPassword)
      toast(t('profile.lotwCredentialsSaved'))
      setLotwUsername('')
      setLotwPassword('')
      setLotwStatus(await api.lotw.status())
    } catch (err) {
      toast(err instanceof Error ? err.message : t('profile.lotwCredentialsSaveFailed'), 'error')
    } finally {
      setLotwLoading(false)
    }
  }

  const handleLotwSync = async () => {
    setLotwSyncing(true)
    try {
      const result = await api.lotw.sync()
      setLotwStatus(await api.lotw.status())
      toast(t('profile.lotwSyncComplete', {
        confirmed: result.confirmed,
        checkedNotFound: result.checkedNotFound,
        unmatched: result.unmatched,
      }))
    } catch (err) {
      toast(err instanceof Error ? err.message : t('profile.syncFailed'), 'error')
    } finally {
      setLotwSyncing(false)
    }
  }

  const handleRemoveFriend = async (friend: Friendship) => {
    const label = friend.otherCallsign || friend.otherName || friend.otherEmail || t('profile.friends.title').toLowerCase()
    if (!window.confirm(t('profile.friends.removeConfirm', { label }))) return

    setRemovingFriendId(friend.otherUserId)
    try {
      await api.friends.remove(friend.otherUserId)
      setFriends(items => items.filter(item => item.otherUserId !== friend.otherUserId))
      toast(t('profile.friends.removed'))
    } catch (err) {
      toast(err instanceof Error ? err.message : t('profile.friends.removeFailed'), 'error')
    } finally {
      setRemovingFriendId(null)
    }
  }

  const handleUnblock = async (blocked: BlockedUser) => {
    const label = blocked.callsign || blocked.name || blocked.email || t('profile.blocks.thisUser')
    if (!window.confirm(t('profile.blocks.unblockConfirm', { label }))) return

    setUnblockingUserId(blocked.userId)
    try {
      await api.safety.unblockUser(blocked.userId)
      setBlockedUsers(items => items.filter(item => item.userId !== blocked.userId))
      toast(t('profile.blocks.unblocked'))
    } catch (err) {
      toast(err instanceof Error ? err.message : t('profile.blocks.unblockFailed'), 'error')
    } finally {
      setUnblockingUserId(null)
    }
  }

  return (
    <div className={pageShellClass}>
      <h1 className="text-3xl font-bold text-white mb-8">{t('profile.title')}</h1>

      <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-800">
        {[
          { id: 'profile', label: t('profile.tabs.profile') },
          { id: 'integrations', label: t('profile.tabs.integrations') },
          { id: 'agent', label: t('profile.tabs.agent') },
          { id: 'friends', label: t('profile.tabs.friends') },
          { id: 'blocks', label: t('profile.tabs.blocks') },
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-500 text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && (
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader><CardTitle>{t('profile.settings')}</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="rounded-md border border-gray-800 bg-gray-950/50 p-3">
                  <LanguageSwitcher />
                </div>
                <Input label={t('profile.callsign')} value={form.callsign} onChange={set('callsign')} placeholder="OZ1ABC" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input label={t('profile.firstName')} value={form.firstName} onChange={set('firstName')} />
                  <Input label={t('profile.lastName')} value={form.lastName} onChange={set('lastName')} />
                </div>
                <Input label={t('profile.country')} value={form.country} onChange={set('country')} />
                <Input label={t('profile.gridLocator')} value={form.gridLocator} onChange={set('gridLocator')} placeholder="JO55WM" />
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-300">{t('profile.defaultStation')}</label>
                  <select value={form.defaultStationId} onChange={set('defaultStationId')} className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white text-sm">
                    <option value="">{t('profile.noDefaultStation')}</option>
                    {stations.map(station => (
                      <option key={station.id} value={station.id}>
                        {stationOptionLabel(station)}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500">{t('profile.defaultStationHelp')}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-300">{t('profile.aboutMe')}</label>
                  <textarea rows={3} value={form.profileDescription} onChange={set('profileDescription')} className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white text-sm" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-300">{t('profile.visibility')}</label>
                  <select value={form.visibility} onChange={set('visibility')} className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white text-sm">
                    <option value={ProfileVisibility.Public}>{t('profile.visibility.public')}</option>
                    <option value={ProfileVisibility.MembersOnly}>{t('profile.visibility.membersOnly')}</option>
                    <option value={ProfileVisibility.Private}>{t('profile.visibility.private')}</option>
                  </select>
                </div>
                <Button type="submit" disabled={loading}>{loading ? t('common.saving') : t('profile.saveProfile')}</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{t('profile.changePassword')}</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
                <Input
                  label={t('profile.currentPassword')}
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={setPassword('currentPassword')}
                  autoComplete="current-password"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label={t('profile.newPassword')}
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={setPassword('newPassword')}
                    autoComplete="new-password"
                  />
                  <Input
                    label={t('profile.confirmPassword')}
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={setPassword('confirmPassword')}
                    autoComplete="new-password"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={
                    passwordLoading ||
                    !passwordForm.currentPassword ||
                    !passwordForm.newPassword ||
                    !passwordForm.confirmPassword
                  }
                >
                  {passwordLoading ? t('profile.updating') : t('profile.changePassword')}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'integrations' && (
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader><CardTitle>{t('profile.integration.qrzLogbook')}</CardTitle></CardHeader>
            <CardContent>
              {qrzStatus?.connected ? (
                <div className="flex flex-col gap-3">
                  <p className="text-green-400 text-sm">
                    {qrzStatus.qrzCallsign ? t('profile.connectedAs', { name: qrzStatus.qrzCallsign }) : t('profile.connectedAsUnknown')}
                    {qrzStatus.lastSyncedAt && (
                      <span className="text-gray-400 ml-2">
                        {t('profile.lastSynced', { date: formatDateTime(qrzStatus.lastSyncedAt, language) })}
                      </span>
                    )}
                  </p>
                  <Button onClick={handleQrzSync} disabled={qrzSyncing} variant="secondary">
                    {qrzSyncing ? t('profile.syncing') : t('profile.syncNow')}
                  </Button>
                </div>
              ) : qrzStatus?.credentialError ? (
                <p className="text-yellow-300 text-sm mb-3">
                  {t('profile.qrzKeyRenew')}
                </p>
              ) : (
                <p className="text-gray-400 text-sm mb-3">{t('profile.notConnectedQrzLogbook')}</p>
              )}
              <div className="mb-4 rounded-md border border-gray-800 bg-gray-950/50 p-3 text-sm text-gray-400">
                {t('profile.qrzLogbookHelp')}
              </div>
              <form onSubmit={handleSaveQrzKey} className="flex flex-col gap-3 mt-4">
                <Input
                  label={qrzStatus?.connected ? t('profile.qrzApiKeyOptional') : t('profile.qrzApiKey')}
                  type="password"
                  value={qrzKey}
                  onChange={e => setQrzKey(e.target.value.toUpperCase())}
                  placeholder="F82B-A8C7-8B74-82EA"
                  autoComplete="off"
                />
                <Button type="submit" disabled={qrzLoading || !qrzKey.trim()}>
                  {qrzLoading ? t('profile.verifying') : t('profile.verifyAndSave')}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{t('profile.integration.qrzLookup')}</CardTitle></CardHeader>
            <CardContent>
              {qrzStatus?.xmlConnected ? (
                <p className="text-green-400 text-sm mb-3">
                  {t('profile.connectedAs', { name: qrzStatus.qrzUsername || t('common.unknown') })}
                </p>
              ) : qrzStatus?.xmlCredentialError ? (
                <p className="text-yellow-300 text-sm mb-3">
                  {t('profile.qrzXmlRenew')}
                </p>
              ) : (
                <p className="text-gray-400 text-sm mb-3">
                  {t('profile.notConnectedQrzLookup')}
                </p>
              )}
              <div className="mb-4 rounded-md border border-gray-800 bg-gray-950/50 p-3 text-sm text-gray-400">
                {t('profile.qrzLookupHelp')}
              </div>
              <form onSubmit={handleSaveQrzCredentials} className="flex flex-col gap-3">
                <Input
                  label={t('profile.qrzUsername')}
                  value={qrzXmlUsername}
                  onChange={e => setQrzXmlUsername(e.target.value)}
                  placeholder={qrzStatus?.qrzUsername ?? 'OZ1ABC'}
                  autoComplete="username"
                />
                <Input
                  label={t('profile.qrzPassword')}
                  type="password"
                  value={qrzXmlPassword}
                  onChange={e => setQrzXmlPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <Button type="submit" disabled={qrzXmlLoading || !qrzXmlUsername.trim() || !qrzXmlPassword}>
                  {qrzXmlLoading ? t('profile.verifying') : t('profile.verifyAndSave')}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{t('profile.integration.lotw')}</CardTitle></CardHeader>
            <CardContent>
              {lotwStatus?.connected ? (
                <div className="flex flex-col gap-3">
                  <p className="text-green-400 text-sm">
                    {t('profile.connectedAs', { name: lotwStatus.username })}
                    {lotwStatus.lastSyncedAt && (
                      <span className="text-gray-400 ml-2">
                        {t('profile.lastSynced', { date: formatDateTime(lotwStatus.lastSyncedAt, language) })}
                      </span>
                    )}
                  </p>
                  <Button onClick={handleLotwSync} disabled={lotwSyncing} variant="secondary">
                    {lotwSyncing ? t('profile.syncing') : t('profile.fetchLotwConfirmations')}
                  </Button>
                </div>
              ) : lotwStatus?.credentialError ? (
                <p className="text-yellow-300 text-sm mb-3">
                  {t('profile.lotwRenew')}
                </p>
              ) : (
                <p className="text-gray-400 text-sm mb-3">
                  {t('profile.notConnectedLotw')}
                </p>
              )}
              <div className="mb-4 rounded-md border border-gray-800 bg-gray-950/50 p-3 text-sm text-gray-400">
                {t('profile.lotwHelp')}
              </div>
              <form onSubmit={handleSaveLotwCredentials} className="flex flex-col gap-3">
                <Input
                  label={t('profile.lotwUsername')}
                  value={lotwUsername}
                  onChange={e => setLotwUsername(e.target.value)}
                  placeholder={lotwStatus?.username ?? 'OZ1ABC'}
                  autoComplete="username"
                />
                <Input
                  label={t('profile.lotwPassword')}
                  type="password"
                  value={lotwPassword}
                  onChange={e => setLotwPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <Button type="submit" disabled={lotwLoading || !lotwUsername.trim() || !lotwPassword}>
                  {lotwLoading ? t('profile.verifying') : t('profile.verifyAndSave')}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{t('profile.integration.eqsl')}</CardTitle></CardHeader>
            <CardContent>
              {eqslStatus?.connected ? (
                <p className="text-green-400 text-sm mb-3">
                  {t('profile.connectedAs', { name: eqslStatus.username })}
                  {eqslStatus.qthNickname && <span className="text-gray-400 ml-2">QTH: {eqslStatus.qthNickname}</span>}
                  {eqslStatus.lastSyncedAt && (
                    <span className="text-gray-400 ml-2">
                      {t('profile.lastUsed', { date: formatDateTime(eqslStatus.lastSyncedAt, language) })}
                    </span>
                  )}
                </p>
              ) : eqslStatus?.credentialError ? (
                <p className="text-yellow-300 text-sm mb-3">
                  {t('profile.eqslRenew')}
                </p>
              ) : (
                <p className="text-gray-400 text-sm mb-3">
                  {t('profile.notConnectedEqsl')}
                </p>
              )}
              <div className="mb-4 rounded-md border border-gray-800 bg-gray-950/50 p-3 text-sm text-gray-400">
                {t('profile.eqslHelp')}
              </div>
              <form onSubmit={handleSaveEqslCredentials} className="flex flex-col gap-3">
                <Input
                  label={t('profile.eqslUsername')}
                  value={eqslUsername}
                  onChange={e => setEqslUsername(e.target.value)}
                  placeholder={eqslStatus?.username ?? 'OZ1ABC'}
                  autoComplete="username"
                />
                <Input
                  label={t('profile.eqslPassword')}
                  type="password"
                  value={eqslPassword}
                  onChange={e => setEqslPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <Input
                  label={t('profile.qthNickname')}
                  value={eqslQthNickname}
                  onChange={e => setEqslQthNickname(e.target.value)}
                  placeholder={eqslStatus?.qthNickname ?? t('profile.optional')}
                />
                <Button type="submit" disabled={eqslLoading || !eqslUsername.trim() || !eqslPassword}>
                  {eqslLoading ? t('common.saving') : t('profile.saveEqsl')}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'agent' && (
        <Card>
          <CardHeader><CardTitle>{t('profile.agent.title')}</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-white font-semibold mb-2">{t('profile.agent.title')}</h2>
                <p className="text-gray-400 text-sm max-w-3xl">{t('profile.agent.description')}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
                  <h3 className="text-white font-semibold mb-1">{t('profile.agent.macos')}</h3>
                  <p className="text-gray-400 text-sm mb-4">{t('profile.agent.macosDescription')}</p>
                  <a href="/agent-downloads/HamHub-WSJTX-Agent-macOS-arm64.zip" download>
                    <Button type="button">{t('profile.agent.downloadMac')}</Button>
                  </a>
                </div>

                <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
                  <h3 className="text-white font-semibold mb-1">{t('profile.agent.windows')}</h3>
                  <p className="text-gray-400 text-sm mb-4">{t('profile.agent.windowsDescription')}</p>
                  <a href="/agent-downloads/HamHub-WSJTX-Agent-Windows-x64.zip" download>
                    <Button type="button">{t('profile.agent.downloadWindows')}</Button>
                  </a>
                </div>
              </div>

              <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
                <h3 className="text-white font-semibold mb-2">{t('profile.agent.setup')}</h3>
                <ol className="list-decimal list-inside text-gray-400 text-sm space-y-1">
                  <li>{t('profile.agent.step1')}</li>
                  <li>{t('profile.agent.step2')}</li>
                  <li>{t('profile.agent.step3')}</li>
                  <li>{t('profile.agent.step4')}</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'friends' && (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>{t('profile.friends.title')}</CardTitle>
                <p className="text-sm text-gray-400 mt-1">
                  {t('profile.friends.description')}
                </p>
              </div>
              <Button type="button" variant="secondary" onClick={loadFriends} disabled={friendsLoading}>
                {friendsLoading ? t('common.loading') : t('common.refresh')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {friendsLoading && friends.length === 0 ? (
              <p className="text-gray-400 text-sm">{t('common.loading')}</p>
            ) : friends.length === 0 ? (
              <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
                <p className="text-white font-medium">{t('profile.friends.emptyTitle')}</p>
                <p className="text-gray-400 text-sm mt-1">
                  {t('profile.friends.emptyDescription')}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                {friends.map(friend => {
                  const displayName = friend.otherCallsign || friend.otherName || friend.otherEmail || t('common.unknownUser')
                  const details = [
                    friend.otherName && friend.otherName !== displayName ? friend.otherName : null,
                    friend.otherGridLocator,
                    friend.otherEmail,
                  ].filter(Boolean)

                  return (
                    <div key={friend.id} className="flex flex-col gap-3 bg-gray-900/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-white font-semibold truncate">{displayName}</p>
                        {details.length > 0 && (
                          <p className="text-gray-400 text-sm mt-1 truncate">{details.join(' - ')}</p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="danger"
                        onClick={() => handleRemoveFriend(friend)}
                        disabled={removingFriendId === friend.otherUserId}
                      >
                        {removingFriendId === friend.otherUserId ? t('profile.friends.removing') : t('profile.friends.remove')}
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'blocks' && (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>{t('profile.blocks.title')}</CardTitle>
                <p className="text-sm text-gray-400 mt-1">
                  {t('profile.blocks.description')}
                </p>
              </div>
              <Button type="button" variant="secondary" onClick={loadBlockedUsers} disabled={blocksLoading}>
                {blocksLoading ? t('common.loading') : t('common.refresh')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {blocksLoading && blockedUsers.length === 0 ? (
              <p className="text-gray-400 text-sm">{t('common.loading')}</p>
            ) : blockedUsers.length === 0 ? (
              <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
                <p className="text-white font-medium">{t('profile.blocks.emptyTitle')}</p>
                <p className="text-gray-400 text-sm mt-1">{t('profile.blocks.emptyDescription')}</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                {blockedUsers.map(blocked => {
                  const displayName = blocked.callsign || blocked.name || blocked.email || t('common.unknownUser')
                  const details = [blocked.name && blocked.name !== displayName ? blocked.name : null, blocked.gridLocator, blocked.country, blocked.email].filter(Boolean)

                  return (
                    <div key={blocked.userId} className="flex flex-col gap-3 bg-gray-900/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-white font-semibold truncate">{displayName}</p>
                        {details.length > 0 && <p className="text-gray-400 text-sm mt-1 truncate">{details.join(' - ')}</p>}
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => handleUnblock(blocked)}
                        disabled={unblockingUserId === blocked.userId}
                      >
                        {unblockingUserId === blocked.userId ? t('profile.blocks.unblocking') : t('profile.blocks.unblock')}
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
