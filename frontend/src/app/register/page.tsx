'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/i18n/LanguageContext'

export default function RegisterPage() {
  const [form, setForm] = useState({ email: '', password: '', callsign: '', firstName: '', lastName: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const { t } = useLanguage()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.auth.register(form)
      await login(form.email, form.password)
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.registerFailed'))
    } finally {
      setLoading(false)
    }
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('auth.registerTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label={`${t('auth.email')} *`} type="email" value={form.email} onChange={set('email')} required />
            <Input label={`${t('auth.password')} *`} type="password" value={form.password} onChange={set('password')} required minLength={6} />
            <Input label={t('profile.callsign')} value={form.callsign} onChange={set('callsign')} placeholder="OZ1ABC" />
            <div className="grid grid-cols-2 gap-3">
              <Input label={t('profile.firstName')} value={form.firstName} onChange={set('firstName')} />
              <Input label={t('profile.lastName')} value={form.lastName} onChange={set('lastName')} />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <Button type="submit" disabled={loading}>{loading ? t('auth.registering') : t('auth.registerSubmit')}</Button>
            <p className="text-center text-sm text-gray-400">
              {t('auth.hasAccount')} <Link href="/login" className="text-blue-400 hover:text-blue-300">{t('auth.logInNow')}</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
