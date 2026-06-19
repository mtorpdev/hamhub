'use client'

import { useState } from 'react'
import { useLanguage } from './LanguageContext'
import type { Language } from './languages'
import { useToast } from '@/contexts/ToastContext'

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage, t } = useLanguage()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  const handleChange = async (nextLanguage: Language) => {
    if (nextLanguage === language) return
    setSaving(true)
    try {
      await setLanguage(nextLanguage)
      toast(t('language.saved'), 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : t('language.saveFailed'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const optionClass = (value: Language) =>
    `min-w-10 rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
      language === value
        ? 'bg-blue-600 text-white'
        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
    }`

  return (
    <div className={`inline-flex items-center gap-2 ${compact ? 'text-xs' : 'text-sm'} text-gray-300`}>
      {!compact && <span>{t('language.label')}</span>}
      <div
        role="group"
        aria-label={t('language.label')}
        className="inline-flex rounded-md border border-gray-700 bg-gray-950/80 p-0.5 shadow-sm"
      >
        <button
          type="button"
          disabled={saving}
          aria-pressed={language === 'en'}
          onClick={() => handleChange('en')}
          className={optionClass('en')}
          title={t('language.english')}
        >
          EN
        </button>
        <button
          type="button"
          disabled={saving}
          aria-pressed={language === 'da'}
          onClick={() => handleChange('da')}
          className={optionClass('da')}
          title={t('language.danish')}
        >
          DA
        </button>
      </div>
    </div>
  )
}
