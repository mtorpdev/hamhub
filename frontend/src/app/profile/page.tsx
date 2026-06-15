'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ProfileVisibility, type EqslStatus, type QrzStatus } from '@/lib/types'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useToast } from '@/contexts/ToastContext'

export default function ProfilePage() {
  const { user } = useAuth()
  useRequireAuth()
  const { toast } = useToast()
  const [form, setForm] = useState({ callsign: '', firstName: '', lastName: '', country: '', gridLocator: '', profileDescription: '', visibility: ProfileVisibility.Public })
  const [loading, setLoading] = useState(false)
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
    }

    loadProfileState()
    return () => { cancelled = true }
  }, [user])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

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

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-white mb-8">Min Profil</h1>
      <Card>
        <CardHeader><CardTitle>Profilindstillinger</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label="Kaldesignal" value={form.callsign} onChange={set('callsign')} placeholder="OZ1ABC" />
            <div className="grid grid-cols-2 gap-3">
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
        <CardHeader><CardTitle>QRZ Integration</CardTitle></CardHeader>
        <CardContent>
          {qrzStatus?.connected ? (
            <div className="flex flex-col gap-3">
              <p className="text-green-400 text-sm">
                Tilsluttet som {qrzStatus.qrzCallsign || 'ukendt'}
                {qrzStatus.lastSyncedAt && (
                  <span className="text-gray-400 ml-2">
                    — Sidst synkroniseret: {new Date(qrzStatus.lastSyncedAt).toLocaleString('da-DK')}
                  </span>
                )}
              </p>
              <Button onClick={handleQrzSync} disabled={qrzSyncing} variant="secondary">
                {qrzSyncing ? 'Synkroniserer...' : 'Synkroniser nu'}
              </Button>
            </div>
          ) : (
            <p className="text-gray-400 text-sm mb-3">Ikke tilsluttet QRZ</p>
          )}
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
          ) : (
            <p className="text-gray-400 text-sm mb-3">
              Ikke tilsluttet — indtast dine QRZ.com login-oplysninger for at aktivere kaldesignals-opslag.
            </p>
          )}
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
                  — Sidst brugt: {new Date(eqslStatus.lastSyncedAt).toLocaleString('da-DK')}
                </span>
              )}
            </p>
          ) : (
            <p className="text-gray-400 text-sm mb-3">
              Ikke tilsluttet — indtast dit eQSL.cc brugernavn og adgangskode for at kunne sende QSOer til eQSL. Login testes først ved upload.
            </p>
          )}
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
  )
}
