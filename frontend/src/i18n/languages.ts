export const SUPPORTED_LANGUAGES = ['en', 'da'] as const
export type Language = (typeof SUPPORTED_LANGUAGES)[number]

export const DEFAULT_LANGUAGE: Language = 'en'
export const LANGUAGE_STORAGE_KEY = 'hamhub-language'

export function normalizeLanguage(value: string | null | undefined): Language | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  if (normalized === 'en' || normalized.startsWith('en-')) return 'en'
  if (normalized === 'da' || normalized.startsWith('da-')) return 'da'
  return null
}

export function detectBrowserLanguage(languages: readonly string[] = []): Language {
  for (const language of languages) {
    const normalized = normalizeLanguage(language)
    if (normalized) return normalized
  }
  return DEFAULT_LANGUAGE
}
