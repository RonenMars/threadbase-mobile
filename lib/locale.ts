import { localeDirection } from './rtl'

export type SupportedLocale = 'en' | 'he' | 'ar' | 'ru'

type SupportedLocaleMetadata = {
  code: SupportedLocale
  labelKey: 'language.english' | 'language.hebrew' | 'language.arabic' | 'language.russian'
}

export const SUPPORTED_LOCALES: readonly SupportedLocaleMetadata[] = [
  { code: 'en', labelKey: 'language.english' },
  { code: 'he', labelKey: 'language.hebrew' },
  { code: 'ar', labelKey: 'language.arabic' },
  { code: 'ru', labelKey: 'language.russian' },
]

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
