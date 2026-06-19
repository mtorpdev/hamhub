import { en, type TranslationKey } from './en'
import { da } from './da'
import type { Language } from '../languages'

export { type TranslationKey }

export const translations: Record<Language, Record<TranslationKey, string>> = {
  en,
  da,
}
