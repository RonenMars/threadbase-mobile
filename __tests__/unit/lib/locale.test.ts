import i18next from 'i18next'
import {
  getSupportedLocaleLabel,
  isRTLLocale,
  resolveSupportedLocale,
  SUPPORTED_LOCALES,
} from '@/lib/locale'

describe('locale', () => {
  it('resolves every locale code to its translated display label', () => {
    const t = i18next.getFixedT('en', 'settings')
    expect(getSupportedLocaleLabel('en', t)).toBe('English')
    expect(getSupportedLocaleLabel('he', t)).toBe('עברית')
    expect(getSupportedLocaleLabel('ar', t)).toBe('العربية')
    expect(getSupportedLocaleLabel('ru', t)).toBe('Русский')
  })

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

  // The metadata deliberately carries no `direction` field: direction is
  // i18next's answer (`i18n.dir(code)`), so a second hardcoded list here could
  // silently disagree with the one the UI actually renders from.
  it('lists every supported locale without duplicating its direction', () => {
    expect(SUPPORTED_LOCALES).toEqual([
      { code: 'en' },
      { code: 'he' },
      { code: 'ar' },
      { code: 'ru' },
    ])
  })

  it('derives RTL from i18next rather than from local metadata', () => {
    expect(isRTLLocale('he')).toBe(true)
    expect(isRTLLocale('ar')).toBe(true)
    expect(isRTLLocale('en')).toBe(false)
    expect(isRTLLocale('ru')).toBe(false)
    for (const { code } of SUPPORTED_LOCALES) {
      expect(isRTLLocale(code)).toBe(i18next.dir(code) === 'rtl')
    }
  })
})
