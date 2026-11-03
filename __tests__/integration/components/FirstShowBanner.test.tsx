import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { StyleSheet } from 'react-native'
import { FirstShowBanner } from '@/components/tour/FirstShowBanner'
import { THEMES, type Theme } from '@/constants/theme'

const mockTheme: { current: Theme } = { current: THEMES.dark }

jest.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => mockTheme.current,
}))

beforeEach(() => {
  jest.clearAllMocks()
  ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(null)
  ;(AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined)
})

describe('FirstShowBanner', () => {
  it('renders the hint text when not yet dismissed', async () => {
    const { findByText } = await render(
      <FirstShowBanner storageKey="test_banner" text="Tap any message to see actions." />
    )
    expect(await findByText('Tap any message to see actions.')).toBeTruthy()
  })

  it('does not render when already dismissed in AsyncStorage', async () => {
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue('seen')
    const { queryByText } = await render(
      <FirstShowBanner storageKey="test_banner" text="Some hint" />
    )
    await waitFor(() => {
      expect(queryByText('Some hint')).toBeNull()
    })
  })

  it('hides the banner and saves seen when dismiss button is pressed', async () => {
    const { findByTestId, queryByText } = await render(
      <FirstShowBanner storageKey="test_banner" text="Some hint" />
    )
    const btn = await findByTestId('first-show-banner-dismiss')
    await fireEvent.press(btn)
    await waitFor(() => {
      expect(queryByText('Some hint')).toBeNull()
    })
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('test_banner', 'seen')
  })
})

describe('FirstShowBanner theming', () => {
  afterEach(() => {
    mockTheme.current = THEMES.dark
  })

  it.each(Object.entries(THEMES))('follows the %s palette', async (_id, theme) => {
    mockTheme.current = theme
    const { findByText } = await render(<FirstShowBanner storageKey="test_banner" text="Some hint" />)
    expect(StyleSheet.flatten((await findByText('Some hint')).props.style).color).toBe(theme.text.secondary)
    expect(StyleSheet.flatten((await findByText('Got it')).props.style).color).toBe(theme.text.accent)
  })
})
