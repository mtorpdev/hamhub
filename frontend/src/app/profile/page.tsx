'use client'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ProfileVisibility, type BlockedUser, type EqslStatus, type Friendship, type QrzStatus } from '@/lib/types'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useToast } from '@/contexts/ToastContext'
import { useLocalOnlyFeatures } from '@/hooks/useLocalOnlyFeatures'

export default function ProfilePage() {
  const { user } = useAuth()
  useRequireAuth()
  const { toast } = useToast()
  const localOnlyFeatures = useLocalOnlyFeatures()
  const [activeTab, setActiveTab] = useState<'profile' | 'integrations' | 'apps' | 'friends' | 'blocks'>('profile')
  const [form, setForm] = useState({ callsign: '', firstName: '', lastName: '', country: '', gridLocator: '', profileDescription: '', visibility: ProfileVisibility.Public })
  const [loading, setLoading] = useState(false)
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
      toast(err instanceof Error ? err.message : 'Kunne ikke hente venner', 'error')
    } finally {
      setFriendsLoading(false)
    }
  }, [toast])

  const loadBlockedUsers = useCallback(async () => {
    setBlocksLoading(true)
    try {
      setBlockedUsers(await api.safety.getBlockedUsers())
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Kunne ikke hente blokeringer', 'error')
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
        profileDescription: user.profileDescription || '',
        visibility: user.visibility,
      })

      api.qrz.status().then(status => {
        if (!cancelled) setQrzStatus(status)
      }).catch(() => {})
      api.eqsl.status().then(status => {
        if (!cancelled) setEqslStatus(status)
      }).catch(() => {})
      api.friends.getAll().then(items => {
        if (!cancelled) setFriends(items)
      }).catch(() => {})
      api.safety.getBlockedUsers().then(items => {
        if (!cancelled) setBlockedUsers(items)
      }).catch(() => {})
    }

    loadProfileState()
    return () => { cancelled = true }
  }, [user])

  useEffect(() => {
    if (localOnlyFeatures.ready && !localOnlyFeatures.enabled && activeTab === 'apps') {
      void Promise.resolve().then(() => setActiveTab('profile'))
    }
  }, [activeTab, localOnlyFeatures.enabled, localOnlyFeatures.ready])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const setPassword = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setPasswordForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.users.updateMe(form as never)
      toast('Profil gemt!')
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast('Den nye adgangskode matcher ikke gentagelsen.', 'error')
      return
    }

    setPasswordLoading(true)
    try {
      await api.users.changePassword(passwordForm)
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      toast('Adgangskode opdateret!')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Kunne ikke skifte adgangskode', 'error')
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
      toast('QRZ API nøgle gemt og verificeret!')
      setQrzKey('')
      const status = await api.qrz.status()
      setQrzStatus(status)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Kunne ikke gemme QRZ nøgle', 'error')
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
      toast('QRZ brugernavn og adgangskode gemt og verificeret!')
      setQrzXmlUsername('')
      setQrzXmlPassword('')
      const status = await api.qrz.status()
      setQrzStatus(status)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Kunne ikke gemme QRZ credentials', 'error')
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
      toast('QRZ synkronisering fuldført!')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Synkronisering mislykkedes', 'error')
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
      toast('eQSL login gemt!')
      setEqslUsername('')
      setEqslPassword('')
      setEqslQthNickname('')
      setEqslStatus(await api.eqsl.status())
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Kunne ikke gemme eQSL login', 'error')
    } finally {
      setEqslLoading(false)
    }
  }

  const handleRemoveFriend = async (friend: Friendship) => {
    const label = friend.otherCallsign || friend.otherName || friend.otherEmail || 'denne ven'
    if (!window.confirm(`Fjern ${label} som ven?`)) return

    setRemovingFriendId(friend.otherUserId)
    try {
      await api.friends.remove(friend.otherUserId)
      setFriends(items => items.filter(item => item.otherUserId !== friend.otherUserId))
      toast('Vennen er fjernet.')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Kunne ikke fjerne ven', 'error')
    } finally {
      setRemovingFriendId(null)
    }
  }

  const handleUnblock = async (blocked: BlockedUser) => {
    const label = blocked.callsign || blocked.name || blocked.email || 'denne bruger'
    if (!window.confirm(`Fjern blokering af ${label}?`)) return

    setUnblockingUserId(blocked.userId)
    try {
      await api.safety.unblockUser(blocked.userId)
      setBlockedUsers(items => items.filter(item => item.userId !== blocked.userId))
      toast('Blokering fjernet.')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Kunne ikke fjerne blokering', 'error')
    } finally {
      setUnblockingUserId(null)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-white mb-8">Min Profil</h1>

      <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-800">
        {[
          { id: 'profile', label: 'Profil' },
          { id: 'integrations', label: 'Integrationer' },
          ...(localOnlyFeatures.enabled ? [{ id: 'apps', label: 'Apps' }] : []),
          { id: 'friends', label: 'Venner' },
          { id: 'blocks', label: 'Blokeringer' },
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
            <CardHeader><CardTitle>Profilindstillinger</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Input label="Kaldesignal" value={form.callsign} onChange={set('callsign')} placeholder="OZ1ABC" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input label="Fornavn" value={form.firstName} onChange={set('firstName')} />
                  <Input label="Efternavn" value={form.lastName} onChange={set('lastName')} />
                </div>
                <Input label="Land" value={form.country} onChange={set('country')} />
                <Input label="Grid Locator" value={form.gridLocator} onChange={set('gridLocator')} placeholder="JO55WM" />
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-300">Om mig</label>
                  <textarea rows={3} value={form.profileDescription} onChange={set('profileDescription')} className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white text-sm" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-300">Synlighed</label>
                  <select value={form.visibility} onChange={set('visibility')} className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white text-sm">
                    <option value={ProfileVisibility.Public}>Offentlig</option>
                    <option value={ProfileVisibility.MembersOnly}>Kun medlemmer</option>
                    <option value={ProfileVisibility.Private}>Privat</option>
                  </select>
                </div>
                <Button type="submit" disabled={loading}>{loading ? 'Gemmer...' : 'Gem profil'}</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Skift adgangskode</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
                <Input
                  label="Nuværende adgangskode"
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={setPassword('currentPassword')}
                  autoComplete="current-password"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Ny adgangskode"
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={setPassword('newPassword')}
                    autoComplete="new-password"
                  />
                  <Input
                    label="Gentag ny adgangskode"
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
                  {passwordLoading ? 'Opdaterer...' : 'Opdater adgangskode'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'integrations' && (
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader><CardTitle>QRZ Integration</CardTitle></CardHeader>
            <CardContent>
              {qrzStatus?.connected ? (
                <div className="flex flex-col gap-3">
                  <p className="text-green-400 text-sm">
                    Tilsluttet som {qrzStatus.qrzCallsign || 'ukendt'}
                    {qrzStatus.lastSyncedAt && (
                      <span className="text-gray-400 ml-2">
                        Sidst synkroniseret: {new Date(qrzStatus.lastSyncedAt).toLocaleString('da-DK')}
                      </span>
                    )}
                  </p>
                  <Button onClick={handleQrzSync} disabled={qrzSyncing} variant="secondary">
                    {qrzSyncing ? 'Synkroniserer...' : 'Synkroniser nu'}
                  </Button>
                </div>
              ) : qrzStatus?.credentialError ? (
                <p className="text-yellow-300 text-sm mb-3">
                  QRZ Logbook nøglen skal gemmes igen. Den gamle krypterede værdi kan ikke læses efter serverens nøgleskift.
                </p>
              ) : (
                <p className="text-gray-400 text-sm mb-3">Ikke tilsluttet QRZ Logbook.</p>
              )}
              <div className="mb-4 rounded-md border border-gray-800 bg-gray-950/50 p-3 text-sm text-gray-400">
                QRZ Logbook API nøglen bruges til at synkronisere din HamHub logbog med QRZ Logbook.
                Sync kører som et job: HamHub henter først QRZ-loggen, matcher lokale QSOer og sender derefter lokale QSOer der mangler en QRZ reference.
              </div>
              <form onSubmit={handleSaveQrzKey} className="flex flex-col gap-3 mt-4">
                <Input
                  label={`QRZ Logbook API nøgle${qrzStatus?.connected ? ' (efterlad tom for at beholde eksisterende)' : ''}`}
                  type="password"
                  value={qrzKey}
                  onChange={e => setQrzKey(e.target.value.toUpperCase())}
                  placeholder="F82B-A8C7-8B74-82EA"
                  autoComplete="off"
                />
                <Button type="submit" disabled={qrzLoading || !qrzKey.trim()}>
                  {qrzLoading ? 'Verificerer...' : 'Gem og verificer'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>QRZ Kaldesignals-opslag</CardTitle></CardHeader>
            <CardContent>
              {qrzStatus?.xmlConnected ? (
                <p className="text-green-400 text-sm mb-3">
                  Tilsluttet som {qrzStatus.qrzUsername}
                </p>
              ) : qrzStatus?.xmlCredentialError ? (
                <p className="text-yellow-300 text-sm mb-3">
                  QRZ XML login skal gemmes igen. Den gamle krypterede adgangskode kan ikke læses.
                </p>
              ) : (
                <p className="text-gray-400 text-sm mb-3">
                  Ikke tilsluttet. Indtast dine QRZ.com login-oplysninger for at aktivere kaldesignals-opslag.
                </p>
              )}
              <div className="mb-4 rounded-md border border-gray-800 bg-gray-950/50 p-3 text-sm text-gray-400">
                Denne opsætning er separat fra Logbook API nøglen. QRZ XML login bruges til callsign-opslag og kræver normalt aktiv QRZ XML adgang.
              </div>
              <form onSubmit={handleSaveQrzCredentials} className="flex flex-col gap-3">
                <Input
                  label="QRZ brugernavn"
                  value={qrzXmlUsername}
                  onChange={e => setQrzXmlUsername(e.target.value)}
                  placeholder={qrzStatus?.qrzUsername ?? 'OZ1ABC'}
                  autoComplete="username"
                />
                <Input
                  label="QRZ adgangskode"
                  type="password"
                  value={qrzXmlPassword}
                  onChange={e => setQrzXmlPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <Button type="submit" disabled={qrzXmlLoading || !qrzXmlUsername.trim() || !qrzXmlPassword}>
                  {qrzXmlLoading ? 'Verificerer...' : 'Gem og verificer'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>eQSL Integration</CardTitle></CardHeader>
            <CardContent>
              {eqslStatus?.connected ? (
                <p className="text-green-400 text-sm mb-3">
                  Tilsluttet som {eqslStatus.username}
                  {eqslStatus.qthNickname && <span className="text-gray-400 ml-2">QTH: {eqslStatus.qthNickname}</span>}
                  {eqslStatus.lastSyncedAt && (
                    <span className="text-gray-400 ml-2">
                      Sidst brugt: {new Date(eqslStatus.lastSyncedAt).toLocaleString('da-DK')}
                    </span>
                  )}
                </p>
              ) : eqslStatus?.credentialError ? (
                <p className="text-yellow-300 text-sm mb-3">
                  eQSL login skal gemmes igen. Den gamle krypterede adgangskode kan ikke læses efter serverens nøgleskift.
                </p>
              ) : (
                <p className="text-gray-400 text-sm mb-3">
                  Ikke tilsluttet. Indtast dit eQSL.cc brugernavn og adgangskode for at kunne sende QSOer til eQSL.
                </p>
              )}
              <div className="mb-4 rounded-md border border-gray-800 bg-gray-950/50 p-3 text-sm text-gray-400">
                eQSL bruges til direkte real-time ADIF upload fra hver QSO. Hvis du har flere eQSL QTH-profiler, skal QTH nickname matche profilen hos eQSL, ellers kan eQSL afvise QSOer på dato/tid.
              </div>
              <form onSubmit={handleSaveEqslCredentials} className="flex flex-col gap-3">
                <Input
                  label="eQSL brugernavn"
                  value={eqslUsername}
                  onChange={e => setEqslUsername(e.target.value)}
                  placeholder={eqslStatus?.username ?? 'OZ1ABC'}
                  autoComplete="username"
                />
                <Input
                  label="eQSL adgangskode"
                  type="password"
                  value={eqslPassword}
                  onChange={e => setEqslPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <Input
                  label="QTH nickname"
                  value={eqslQthNickname}
                  onChange={e => setEqslQthNickname(e.target.value)}
                  placeholder={eqslStatus?.qthNickname ?? 'Valgfrit'}
                />
                <Button type="submit" disabled={eqslLoading || !eqslUsername.trim() || !eqslPassword}>
                  {eqslLoading ? 'Gemmer...' : 'Gem eQSL login'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'apps' && (
        <Card>
          <CardHeader><CardTitle>HamHub Apps</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-white font-semibold mb-2">WSJT-X Agent</h2>
                <p className="text-gray-400 text-sm max-w-3xl">
                  Agenten kører lokalt på din computer, lytter efter WSJT-X UDP beskeder og sender decodes og loggede QSOer til HamHub.
                  Den bruger production API på https://api.hamhub.dk og gemmer kun din lokale opsætning på din egen computer.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
                  <h3 className="text-white font-semibold mb-1">macOS</h3>
                  <p className="text-gray-400 text-sm mb-4">Til Apple Silicon Mac. Pak zip-filen ud og start appen.</p>
                  <a href="/downloads/HamHub-WSJTX-Agent-macOS-arm64.zip" download>
                    <Button type="button">Download til Mac</Button>
                  </a>
                </div>

                <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
                  <h3 className="text-white font-semibold mb-1">Windows</h3>
                  <p className="text-gray-400 text-sm mb-4">Til 64-bit Windows. Pak zip-filen ud og start HamHub.WsjtxTray.exe.</p>
                  <a href="/downloads/HamHub-WSJTX-Agent-Windows-x64.zip" download>
                    <Button type="button">Download til Windows</Button>
                  </a>
                </div>
              </div>

              <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
                <h3 className="text-white font-semibold mb-2">WSJT-X opsætning</h3>
                <ol className="list-decimal list-inside text-gray-400 text-sm space-y-1">
                  <li>Installer agenten til dit operativsystem.</li>
                  <li>Log ind med din HamHub email og adgangskode.</li>
                  <li>Sæt WSJT-X UDP server til port 2237.</li>
                  <li>Lad agenten køre mens WSJT-X er aktiv.</li>
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
                <CardTitle>Venner</CardTitle>
                <p className="text-sm text-gray-400 mt-1">
                  Se dine accepterede venner og fjern forbindelser direkte fra profilen.
                </p>
              </div>
              <Button type="button" variant="secondary" onClick={loadFriends} disabled={friendsLoading}>
                {friendsLoading ? 'Henter...' : 'Opdater'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {friendsLoading && friends.length === 0 ? (
              <p className="text-gray-400 text-sm">Henter venner...</p>
            ) : friends.length === 0 ? (
              <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
                <p className="text-white font-medium">Ingen venner endnu</p>
                <p className="text-gray-400 text-sm mt-1">
                  Find andre brugere under Beskeder og send en venneanmodning.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                {friends.map(friend => {
                  const displayName = friend.otherCallsign || friend.otherName || friend.otherEmail || 'Ukendt bruger'
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
                          <p className="text-gray-400 text-sm mt-1 truncate">{details.join(' · ')}</p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="danger"
                        onClick={() => handleRemoveFriend(friend)}
                        disabled={removingFriendId === friend.otherUserId}
                      >
                        {removingFriendId === friend.otherUserId ? 'Fjerner...' : 'Fjern ven'}
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
                <CardTitle>Blokeringer</CardTitle>
                <p className="text-sm text-gray-400 mt-1">
                  Brugere på listen kan ikke sende private beskeder til dig.
                </p>
              </div>
              <Button type="button" variant="secondary" onClick={loadBlockedUsers} disabled={blocksLoading}>
                {blocksLoading ? 'Henter...' : 'Opdater'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {blocksLoading && blockedUsers.length === 0 ? (
              <p className="text-gray-400 text-sm">Henter blokeringer...</p>
            ) : blockedUsers.length === 0 ? (
              <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
                <p className="text-white font-medium">Ingen blokerede brugere</p>
                <p className="text-gray-400 text-sm mt-1">Blokeringer du laver fra community eller beskeder vises her.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                {blockedUsers.map(blocked => {
                  const displayName = blocked.callsign || blocked.name || blocked.email || 'Ukendt bruger'
                  const details = [blocked.name && blocked.name !== displayName ? blocked.name : null, blocked.gridLocator, blocked.country, blocked.email].filter(Boolean)

                  return (
                    <div key={blocked.userId} className="flex flex-col gap-3 bg-gray-900/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-white font-semibold truncate">{displayName}</p>
                        {details.length > 0 && <p className="text-gray-400 text-sm mt-1 truncate">{details.join(' · ')}</p>}
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => handleUnblock(blocked)}
                        disabled={unblockingUserId === blocked.userId}
                      >
                        {unblockingUserId === blocked.userId ? 'Fjerner...' : 'Fjern blokering'}
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
