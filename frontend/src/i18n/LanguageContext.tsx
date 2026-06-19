'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { DEFAULT_LANGUAGE, detectBrowserLanguage, LANGUAGE_STORAGE_KEY, type Language, normalizeLanguage } from './languages'
import { translations, type TranslationKey } from './translations'

type InterpolationValues = Record<string, string | number | null | undefined>

interface LanguageContextValue {
  language: Language
  setLanguage: (language: Language) => Promise<void>
  t: (key: TranslationKey, values?: InterpolationValues) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

function readInitialLanguage(): Language {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE
  const stored = normalizeLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY))
  if (stored) return stored
  return detectBrowserLanguage(window.navigator.languages)
}

function interpolate(template: string, values?: InterpolationValues) {
  if (!values) return template
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''))
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth()
  const [language, setLanguageState] = useState<Language>(readInitialLanguage)

  useEffect(() => {
    const profileLanguage = normalizeLanguage(user?.preferredLanguage)
    if (profileLanguage) setLanguageState(profileLanguage)
  }, [user?.preferredLanguage])

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.lang = language
  }, [language])

  const setLanguage = useCallback(async (nextLanguage: Language) => {
    setLanguageState(nextLanguage)
    if (typeof window !== 'undefined') window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage)
    if (!isAuthenticated) return
    await api.users.saveLanguage(nextLanguage)
  }, [isAuthenticated])

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    t: (key, values) => interpolate(translations[language][key] ?? translations.en[key] ?? key, values),
  }), [language, setLanguage])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}
