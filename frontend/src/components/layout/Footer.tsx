'use client'

import { viewportShellClass } from '@/lib/layout'
import { useLanguage } from '@/i18n/LanguageContext'

export function Footer() {
  const { t } = useLanguage()

  return (
    <footer className="mt-auto border-t border-gray-800 bg-gray-900">
      <div className={`${viewportShellClass} py-8`}>
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-2">
            <span className="text-white font-bold">HamHub</span>
            <span className="ml-2 text-sm text-gray-500">{t('app.tagline')}</span>
          </div>
          <div className="text-sm text-gray-500">
            73 de HamHub &bull; {new Date().getFullYear()}
          </div>
        </div>
      </div>
    </footer>
  )
}
