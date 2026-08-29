/**
 * Runtime direction must follow i18next, not the native layout state.
 *
 * `I18nManager.isRTL` reports the direction the app *booted* with, so a build
 * that read it could only change direction across a restart. These tests pin
 * the replacement: `i18n.dir()` drives everything, a switch is a plain
 * `changeLanguage`, and nothing in that path reloads the app.
 */
import React from 'react'
import { I18nManager, StyleSheet, Text, View } from 'react-native'
import { act, render } from '@testing-library/react-native'
import * as Updates from 'expo-updates'
import i18n from '@/test-utils/i18n-setup'
import { localeDirection, useAppDirection, flexRow, textDirectionStyle, ltrContentStyle, blockTextDirectionStyle, rtlStyleKit } from '@/lib/rtl'
import { isRTLLocale, SUPPORTED_LOCALES } from '@/lib/locale'

function setNativeRTL(value: boolean) {
  Object.defineProperty(I18nManager, 'isRTL', { configurable: true, value })
}

// A minimal direction-sensitive consumer: a row that reverses, a heading that
// echoes the resolved direction, and translated copy.
function DirectionProbe() {
  const { direction, isRTL, language } = useAppDirection()
  return (
    <View testID="probe-row" style={{ direction, flexDirection: flexRow(isRTL) }}>
      <Text testID="probe-direction">{direction}</Text>
      <Text testID="probe-language">{language}</Text>
      <Text testID="probe-copy">{i18n.t('onboarding:language.continue')}</Text>
    </View>
  )
}

describe('useAppDirection', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    setNativeRTL(false)
    ;(Updates.reloadAsync as jest.Mock).mockClear()
  })

  afterAll(async () => {
    await i18n.changeLanguage('en')
    setNativeRTL(false)
  })

  it.each([
    ['en', 'ltr', false],
    ['ru', 'ltr', false],
    ['he', 'rtl', true],
    ['ar', 'rtl', true],
  ] as const)('resolves %s to %s without consulting native state', (locale, direction, rtl) => {
    expect(i18n.dir(locale)).toBe(direction)
    expect(localeDirection(locale)).toBe(direction)
    expect(isRTLLocale(locale)).toBe(rtl)
  })

  it('derives every supported locale direction from i18next, with no hardcoded list', () => {
    expect(SUPPORTED_LOCALES.map((option) => option.code)).toEqual(['en', 'he', 'ar', 'ru'])
    for (const option of SUPPORTED_LOCALES) {
      expect(localeDirection(option.code)).toBe(i18n.dir(option.code))
      // The metadata carries no direction of its own to drift from i18next.
      expect(option).not.toHaveProperty('direction')
    }
  })

  it('reports the LTR state for English', async () => {
    const { getByTestId } = await render(<DirectionProbe />)

    expect(getByTestId('probe-direction')).toHaveTextContent('ltr')
    expect(getByTestId('probe-language')).toHaveTextContent('en')
    expect(StyleSheet.flatten(getByTestId('probe-row').props.style)).toEqual(
      expect.objectContaining({ direction: 'ltr', flexDirection: 'row' }),
    )
  })

  it('reports the RTL state for Hebrew', async () => {
    await i18n.changeLanguage('he')
    const { getByTestId } = await render(<DirectionProbe />)

    expect(getByTestId('probe-direction')).toHaveTextContent('rtl')
    expect(StyleSheet.flatten(getByTestId('probe-row').props.style)).toEqual(
      expect.objectContaining({ direction: 'rtl', flexDirection: 'row-reverse' }),
    )
  })

  it('switches LTR → RTL at runtime, re-rendering translations and layout with no reload', async () => {
    const { getByTestId } = await render(<DirectionProbe />)
    expect(getByTestId('probe-direction')).toHaveTextContent('ltr')
    expect(getByTestId('probe-copy')).toHaveTextContent('Continue')

    await act(async () => {
      await i18n.changeLanguage('he')
    })

    expect(getByTestId('probe-direction')).toHaveTextContent('rtl')
    expect(getByTestId('probe-language')).toHaveTextContent('he')
    expect(getByTestId('probe-copy')).toHaveTextContent('המשך')
    expect(StyleSheet.flatten(getByTestId('probe-row').props.style)).toEqual(
      expect.objectContaining({ direction: 'rtl', flexDirection: 'row-reverse' }),
    )
    expect(Updates.reloadAsync).not.toHaveBeenCalled()
  })

  it('switches RTL → LTR at runtime with no reload', async () => {
    await i18n.changeLanguage('he')
    const { getByTestId } = await render(<DirectionProbe />)
    expect(getByTestId('probe-direction')).toHaveTextContent('rtl')

    await act(async () => {
      await i18n.changeLanguage('en')
    })

    expect(getByTestId('probe-direction')).toHaveTextContent('ltr')
    expect(getByTestId('probe-copy')).toHaveTextContent('Continue')
    expect(StyleSheet.flatten(getByTestId('probe-row').props.style)).toEqual(
      expect.objectContaining({ direction: 'ltr', flexDirection: 'row' }),
    )
    expect(Updates.reloadAsync).not.toHaveBeenCalled()
  })

  it.each([
    ['en', 'he', 'rtl'],
    ['he', 'en', 'ltr'],
    ['ru', 'ar', 'rtl'],
    ['ar', 'ru', 'ltr'],
    ['he', 'ar', 'rtl'],
    ['en', 'ru', 'ltr'],
  ] as const)('follows the %s → %s switch to %s', async (from, to, expected) => {
    await i18n.changeLanguage(from)
    const { getByTestId } = await render(<DirectionProbe />)

    await act(async () => {
      await i18n.changeLanguage(to)
    })

    expect(getByTestId('probe-direction')).toHaveTextContent(expected)
    expect(getByTestId('probe-language')).toHaveTextContent(to)
    expect(Updates.reloadAsync).not.toHaveBeenCalled()
  })

  it.each([
    ['en', true, 'ltr'],
    ['he', false, 'rtl'],
    ['ar', false, 'rtl'],
    ['ru', true, 'ltr'],
  ] as const)(
    'ignores stale native RTL state: %s with I18nManager.isRTL=%s stays %s',
    async (locale, nativeIsRTL, expected) => {
      setNativeRTL(nativeIsRTL)
      await i18n.changeLanguage(locale)

      const { getByTestId } = await render(<DirectionProbe />)

      expect(I18nManager.isRTL).toBe(nativeIsRTL)
      expect(getByTestId('probe-direction')).toHaveTextContent(expected)
      expect(StyleSheet.flatten(getByTestId('probe-row').props.style)).toEqual(
        expect.objectContaining({ direction: expected }),
      )
    },
  )
})

describe('text direction helpers', () => {
  it('builds the runtime text/input triple from the resolved direction', () => {
    expect(textDirectionStyle('rtl')).toEqual({
      direction: 'rtl',
      writingDirection: 'rtl',
      textAlign: 'auto',
    })
    expect(blockTextDirectionStyle('ltr')).toEqual({
      direction: 'ltr',
      writingDirection: 'ltr',
      textAlign: 'auto',
      width: '100%',
    })
    expect(ltrContentStyle).toEqual({
      direction: 'ltr',
      writingDirection: 'ltr',
      textAlign: 'auto',
    })
  })

  it('exposes named copy, ltr, and overlay fragments on rtlStyleKit', () => {
    const rtl = rtlStyleKit('rtl')
    expect(rtl.isRTL).toBe(true)
    expect(rtl.copy).toEqual(textDirectionStyle('rtl'))
    expect(rtl.block).toEqual(blockTextDirectionStyle('rtl'))
    expect(rtl.ltr).toEqual(ltrContentStyle)
    expect(rtl.overlay).toEqual({ direction: 'rtl' })

    const ltr = rtlStyleKit('ltr')
    expect(ltr.isRTL).toBe(false)
    expect(ltr.copy).toEqual(textDirectionStyle('ltr'))
    expect(ltr.overlay).toEqual({ direction: 'ltr' })
  })
})
