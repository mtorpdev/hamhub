'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { api } from '@/lib/api'
import type { User } from '@/lib/types'

interface AuthContextType {
  user: User | null
  token: string | null
  roles: string[]
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  isAdmin: boolean
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [roles, setRoles] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const storedToken = localStorage.getItem('token')
    if (storedToken) {
      setToken(storedToken)
      api.users.me()
        .then(u => setUser(u))
        .catch(() => { localStorage.removeItem('token'); setToken(null) })
        .finally(() => setIsLoading(false))

      const storedRoles = JSON.parse(localStorage.getItem('roles') || '[]')
      setRoles(storedRoles)
    } else {
      setIsLoading(false)
    }
  }, [])

  const login = async (email: string, password: string) => {
    const res = await api.auth.login(email, password)
    localStorage.setItem('token', res.token)
    localStorage.setItem('roles', JSON.stringify(res.roles))
    setToken(res.token)
    setRoles(res.roles)
    const me = await api.users.me()
    setUser(me)
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('roles')
    setToken(null)
    setUser(null)
    setRoles([])
  }

  return (
    <AuthContext.Provider value={{
      user, token, roles, isLoading,
      login, logout,
      isAdmin: roles.includes('Admin'),
      isAuthenticated: !!token,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
