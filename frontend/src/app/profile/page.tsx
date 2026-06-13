'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ProfileVisibility } from '@/lib/types'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useToast } from '@/contexts/ToastContext'

export default function ProfilePage() {
  const { user } = useAuth()
  useRequireAuth()
  const { toast } = useToast()
  const [form, setForm] = useState({ callsign: '', firstName: '', lastName: '', country: '', gridLocator: '', profileDescription: '', visibility: ProfileVisibility.Public })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) setForm({
      callsign: user.callsign || '',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      country: user.country || '',
      gridLocator: user.gridLocator || '',
      profileDescription: user.profileDescription || '',
      visibility: user.visibility,
    })
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

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
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
    </div>
  )
}
