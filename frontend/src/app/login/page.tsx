'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useLanguage } from '@/i18n/LanguageContext'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
      await login(email, password)
      router.push('/dashboard')
    } catch {
      setError(t('auth.loginFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('auth.loginTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label={t('auth.email')} type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="your@email.com" />
            <Input label={t('auth.password')} type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <Button type="submit" disabled={loading}>{loading ? t('auth.loggingIn') : t('auth.loginSubmit')}</Button>
            <p className="text-center text-sm text-gray-400">
              {t('auth.noAccount')} <Link href="/register" className="text-blue-400 hover:text-blue-300">{t('auth.registerSubmit')}</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
