import type { TFunction } from 'i18next'
import { localeDirection } from './rtl'

export type SupportedLocale = 'en' | 'he' | 'ar' | 'ru'

export const SUPPORTED_LOCALES = [
  { code: 'en' },
  { code: 'he' },
  { code: 'ar' },
  { code: 'ru' },
] as const satisfies readonly { code: SupportedLocale }[]

export function getSupportedLocaleLabel(locale: SupportedLocale, t: TFunction<'settings'>): string {
  switch (locale) {
    case 'en':
      return t('language.english')
    case 'he':
      return t('language.hebrew')
    case 'ar':
      return t('language.arabic')
    case 'ru':
      return t('language.russian')
  }
}

function canonicalLanguage(value: string | null | undefined): SupportedLocale | undefined {
  if (!value) return undefined
  const primary = value.trim().toLowerCase().split(/[-_]/)[0]
  switch (primary) {
    case 'en':
      return 'en'
    case 'he':
    case 'iw': // Android/Java historical Hebrew code
      return 'he'
    case 'ar':
      return 'ar'
    case 'ru':
      return 'ru'
    default:
      return undefined
  }
}

/**
 * First supported match from the device preference list (`expo-localization`
 * `getLocales()`), else English. Used as the first-run default.
 */
export function resolveSupportedLocale(
  deviceLocales: readonly {
    languageCode?: string | null
    languageTag?: string | null
  }[],
): SupportedLocale {
  for (const locale of deviceLocales) {
    const match = canonicalLanguage(locale.languageCode) ?? canonicalLanguage(locale.languageTag)
    if (match) return match
  }
  return 'en'
}

export function isRTLLocale(locale: SupportedLocale): boolean {
  return localeDirection(locale) === 'rtl'
}
