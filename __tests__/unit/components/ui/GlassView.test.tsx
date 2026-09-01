import React from 'react'
import { AccessibilityInfo, StyleSheet } from 'react-native'
import { render, waitFor } from '@testing-library/react-native'
import { GlassFill } from '@/components/ui/GlassFill'
import { GlassView } from '@/components/ui/GlassView'
import { dark } from '@/constants/theme'

const mockUseTheme = jest.fn(() => dark)
const mockUseIsGlass = jest.fn(() => true)
const mockIsGlassEffectAPIAvailable = jest.fn(() => true)

jest.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
  useIsGlass: () => mockUseIsGlass(),
}))

jest.mock('expo-blur', () => ({
  BlurView: ({ children, ...props }: { children?: React.ReactNode }) => {
    const { View } = require('react-native')
    return <View {...props} testID="blur-view">{children}</View>
  },
}))

jest.mock('expo-glass-effect', () => ({
  GlassView: ({ children, ...props }: { children?: React.ReactNode }) => {
    const { View } = require('react-native')
    return <View {...props} testID="native-glass-view">{children}</View>
  },
  isGlassEffectAPIAvailable: () => mockIsGlassEffectAPIAvailable(),
}))

describe('GlassView', () => {
  beforeEach(() => {
    mockUseTheme.mockReturnValue(dark)
    mockIsGlassEffectAPIAvailable.mockReturnValue(true)
  })

  it('uses untinted Expo native Liquid Glass when the platform API is available', async () => {
    const screen = await render(<GlassView testID="surface" />)

    expect(screen.getByTestId('native-glass-view').props.tintColor).toBeUndefined()
    expect(screen.queryByTestId('blur-view')).toBeNull()
  })

  it('retains the blur fallback when the native API is unavailable', async () => {
    mockIsGlassEffectAPIAvailable.mockReturnValue(false)

    const screen = await render(<GlassView testID="surface" />)

    expect(screen.getByTestId('blur-view')).toBeOnTheScreen()
    expect(screen.queryByTestId('native-glass-view')).toBeNull()
  })

  it('uses an opaque fallback when Reduce Transparency is enabled', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled').mockResolvedValueOnce(true)

    const screen = await render(<GlassView testID="surface" />)

    await waitFor(() => {
      expect(screen.queryByTestId('native-glass-view')).toBeNull()
      expect(StyleSheet.flatten(screen.getByTestId('surface').props.style)).toMatchObject({
        backgroundColor: dark.bg.secondary,
      })
    })
  })

  it('does not add a second material layer inside controls', async () => {
    const screen = await render(<GlassFill />)

    expect(screen.queryByTestId('native-glass-view')).toBeNull()
    expect(screen.queryByTestId('blur-view')).toBeNull()
  })

  it('adds one native material layer when used as a major surface background', async () => {
    const screen = await render(<GlassFill material />)

    expect(screen.getByTestId('native-glass-view')).toBeOnTheScreen()
  })
})
