import {
  isRTLLocale,
  resolveSupportedLocale,
  SUPPORTED_LOCALES,
} from '@/lib/locale'

describe('locale', () => {
  it('selects the first supported device preference', () => {
    expect(
      resolveSupportedLocale([
        { languageCode: 'ja' },
        { languageCode: 'he' },
        { languageCode: 'ar' },
      ]),
    ).toBe('he')
  })

  it('falls back to English when no device preference is supported', () => {
    expect(resolveSupportedLocale([{ languageCode: 'ja' }, { languageCode: 'fr' }])).toBe('en')
  })

  it('provides direction metadata for every supported locale', () => {
    expect(SUPPORTED_LOCALES).toEqual([
      { code: 'en', labelKey: 'language.english', direction: 'ltr' },
      { code: 'he', labelKey: 'language.hebrew', direction: 'rtl' },
      { code: 'ar', labelKey: 'language.arabic', direction: 'rtl' },
      { code: 'ru', labelKey: 'language.russian', direction: 'ltr' },
    ])
    expect(isRTLLocale('he')).toBe(true)
    expect(isRTLLocale('ar')).toBe(true)
    expect(isRTLLocale('en')).toBe(false)
  })
})
