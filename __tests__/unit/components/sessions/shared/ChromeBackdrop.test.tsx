import React from 'react'
import { AccessibilityInfo } from 'react-native'
import { render, waitFor } from '@testing-library/react-native'
import { isLiquidGlassAvailable } from 'expo-glass-effect'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { ChromeBackdrop } from '@/components/sessions/shared/ChromeBackdrop'

jest.mock('expo-glass-effect', () => {
  const ReactActual = require('react')
  const { View } = require('react-native')
  return {
    isLiquidGlassAvailable: jest.fn(() => false),
    isGlassEffectAPIAvailable: jest.fn(() => false),
    GlassView: (props: Record<string, unknown>) => ReactActual.createElement(View, props),
  }
})

jest.mock('expo-linear-gradient', () => {
  const ReactActual = require('react')
  const { View } = require('react-native')
  return {
    LinearGradient: (props: Record<string, unknown>) => ReactActual.createElement(View, props),
  }
})

const glassAvailable = isLiquidGlassAvailable as jest.Mock

function renderBackdrop() {
  return render(
    <ThemeProvider>
      <ChromeBackdrop />
    </ThemeProvider>,
  )
}

describe('ChromeBackdrop', () => {
  beforeEach(() => {
    glassAvailable.mockReturnValue(false)
    jest.spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled').mockResolvedValue(false)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('always paints the scrim, with no glass where the device has none', async () => {
    const { getByTestId, queryByTestId } = await renderBackdrop()
    expect(getByTestId('chrome-scrim')).toBeTruthy()
    expect(queryByTestId('chrome-glass')).toBeNull()
  })

  it('layers glass under the scrim only where Liquid Glass is available', async () => {
    glassAvailable.mockReturnValue(true)
    const { getByTestId } = await renderBackdrop()
    expect(getByTestId('chrome-glass')).toBeTruthy()
    expect(getByTestId('chrome-scrim')).toBeTruthy()
  })

  it('drops the glass under Reduce Transparency and keeps the scrim', async () => {
    glassAvailable.mockReturnValue(true)
    jest.spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled').mockResolvedValue(true)
    const { getByTestId, queryByTestId } = await renderBackdrop()
    await waitFor(() => expect(queryByTestId('chrome-glass')).toBeNull())
    expect(getByTestId('chrome-scrim')).toBeTruthy()
  })
})
