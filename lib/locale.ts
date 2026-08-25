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

export function resolveSupportedLocale(
  deviceLocales: readonly { languageCode?: string | null }[],
): SupportedLocale {
  return (
    deviceLocales
      .map((locale) => SUPPORTED_LOCALES.find(({ code }) => code === locale.languageCode)?.code)
      .find((locale): locale is SupportedLocale => locale !== undefined) ?? 'en'
  )
}

export function isRTLLocale(locale: SupportedLocale): boolean {
  return localeDirection(locale) === 'rtl'
}
