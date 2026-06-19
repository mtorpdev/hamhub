import type { Language } from './languages'

export function localeForLanguage(language: Language) {
  return language === 'da' ? 'da-DK' : 'en-US'
}

export function formatDateTime(value: string | Date, language: Language) {
  return new Date(value).toLocaleString(localeForLanguage(language))
}
