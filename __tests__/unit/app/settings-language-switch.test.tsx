/**
 * The settings language switch used to gate an LTR↔RTL change behind a
 * "restart required" alert, `I18nManager.forceRTL` and `Updates.reloadAsync`.
 * Direction now comes from i18next, so the switch is a plain `changeLanguage`
 * and the screen stays mounted.
 */
import React from 'react'
import { Alert, I18nManager } from 'react-native'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import * as Updates from 'expo-updates'
import i18n from '@/test-utils/i18n-setup'
import SettingsScreen from '@/app/settings'
import { useSettingsStore } from '@/stores/settings'

describe('settings language switch', () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    useSettingsStore.setState({ locale: 'en' })
    await i18n.changeLanguage('en')
    Object.defineProperty(I18nManager, 'isRTL', { configurable: true, value: false })
    jest.spyOn(I18nManager, 'forceRTL').mockImplementation(() => undefined)
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
  })

  afterEach(async () => {
    jest.restoreAllMocks()
    await act(async () => {
      await i18n.changeLanguage('en')
    })
  })

  it('switches English → Hebrew in place, with no alert, no forceRTL and no reload', async () => {
    const screen = await render(<SettingsScreen />)

    await fireEvent.press(screen.getByText('עברית'))

    await waitFor(() => {
      expect(useSettingsStore.getState().locale).toBe('he')
      expect(i18n.language).toBe('he')
    })
    expect(i18n.dir()).toBe('rtl')
    expect(Updates.reloadAsync).not.toHaveBeenCalled()
    expect(I18nManager.forceRTL).not.toHaveBeenCalled()
    expect(Alert.alert).not.toHaveBeenCalled()
    // The screen was never torn down — the same tree is still mounted.
    expect(screen.getByText('עברית')).toBeTruthy()
  })

  it('switches Hebrew → English back to LTR with no reload, even when native state says RTL', async () => {
    useSettingsStore.setState({ locale: 'he' })
    await i18n.changeLanguage('he')
    Object.defineProperty(I18nManager, 'isRTL', { configurable: true, value: true })
    const screen = await render(<SettingsScreen />)

    await fireEvent.press(screen.getByText('English'))

    await waitFor(() => {
      expect(useSettingsStore.getState().locale).toBe('en')
      expect(i18n.language).toBe('en')
    })
    expect(i18n.dir()).toBe('ltr')
    expect(Updates.reloadAsync).not.toHaveBeenCalled()
    expect(I18nManager.forceRTL).not.toHaveBeenCalled()
  })

  it('switches between two LTR languages with no reload', async () => {
    const screen = await render(<SettingsScreen />)

    await fireEvent.press(screen.getByText('Русский'))

    await waitFor(() => expect(i18n.language).toBe('ru'))
    expect(i18n.dir()).toBe('ltr')
    expect(Updates.reloadAsync).not.toHaveBeenCalled()
  })
})
