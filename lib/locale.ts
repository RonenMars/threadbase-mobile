export type SupportedLocale = 'en' | 'he' | 'ar' | 'ru'

type SupportedLocaleMetadata = {
  code: SupportedLocale
  labelKey: 'language.english' | 'language.hebrew' | 'language.arabic' | 'language.russian'
  direction: 'ltr' | 'rtl'
}

export const SUPPORTED_LOCALES: readonly SupportedLocaleMetadata[] = [
  { code: 'en', labelKey: 'language.english', direction: 'ltr' },
  { code: 'he', labelKey: 'language.hebrew', direction: 'rtl' },
  { code: 'ar', labelKey: 'language.arabic', direction: 'rtl' },
  { code: 'ru', labelKey: 'language.russian', direction: 'ltr' },
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
  return SUPPORTED_LOCALES.find(({ code }) => code === locale)?.direction === 'rtl'
}
