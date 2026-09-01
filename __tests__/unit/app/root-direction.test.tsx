/**
 * The app's layout direction is painted once, at the root, from i18next.
 *
 * `DirectionRoot` sets Yoga's `direction` on the view that wraps the whole
 * tree, which is what makes `paddingStart`/`marginEnd`/`flexDirection: 'row'`
 * resolve against the selected language. Because it is a style — not native
 * `I18nManager` state — it changes on `changeLanguage` with no reload, and it
 * must ignore `I18nManager.isRTL`, which only reflects the boot direction.
 */
import React from 'react'
import { I18nManager, StyleSheet, Text } from 'react-native'
import { act, render } from '@testing-library/react-native'
import type { NativeStackNavigationOptions } from 'expo-router'
import * as Updates from 'expo-updates'

import { DirectionRoot, ThemedStack } from '@/app/_layout'
import i18n from '@/lib/i18n'
import { dark, type Theme } from '@/constants/theme'
import { useRouter } from 'expo-router'

const mockThemeState: { theme: Theme; isGlass: boolean } = { theme: dark, isGlass: false }
const mockCapture: { screenOptions?: NativeStackNavigationOptions } = {}
const mockStackRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  navigate: jest.fn(),
  canGoBack: jest.fn(() => true),
}

jest.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => mockThemeState.theme,
  useIsGlass: () => mockThemeState.isGlass,
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}))

jest.mock('expo-router', () => {
  const ReactActual = require('react') as typeof React
  const { View } = require('react-native')
  const Stack = ({
    children,
    screenOptions,
  }: {
    children?: React.ReactNode
    screenOptions?: NativeStackNavigationOptions
  }) => {
    mockCapture.screenOptions = screenOptions
    return ReactActual.createElement(View, null, children)
  }
  Stack.Screen = () => null
  return {
    Stack,
    ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
    DefaultTheme: { dark: false, colors: {} },
    DarkTheme: { dark: true, colors: {} },
    useRouter: () => mockStackRouter,
    useSegments: () => [],
    useGlobalSearchParams: () => ({}),
    useRootNavigationState: () => ({ key: 'root' }),
  }
})

// app/_layout.tsx module-scope side effects that jest.setup.js doesn't cover.
jest.mock('react-native-get-random-values', () => ({}))
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(() => Promise.resolve()),
}))
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }))
jest.mock('expo-linear-gradient', () => {
  const ReactActual = require('react') as typeof React
  const { View } = require('react-native')
  return {
    LinearGradient: ({ children }: { children?: React.ReactNode }) =>
      ReactActual.createElement(View, null, children),
  }
})
jest.mock('phosphor-react-native', () => {
  const ReactActual = require('react') as typeof React
  return {
    CaretLeft: () => null,
    IconContext: ReactActual.createContext({}),
  }
})
jest.mock('@/hooks/useBiometricLock', () => ({
  useBiometricLock: () => ({ locked: false, authenticate: jest.fn() }),
}))
jest.mock('@/lib/clientLog', () => ({
  installClientLogCapture: jest.fn(),
  clientLog: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))
jest.mock('@/services/ws-client', () => ({
  wsManager: {
    connect: jest.fn(),
    onAll: jest.fn(() => jest.fn()),
    onAnyStatusChange: jest.fn(() => jest.fn()),
    disconnectAll: jest.fn(),
  },
}))
jest.mock('@/services/push', () => ({
  registerPushTokenForAll: jest.fn(() => Promise.resolve()),
}))
jest.mock('@/components/SplashAnimation', () => ({ SplashAnimation: () => null }))

function setNativeRTL(value: boolean) {
  Object.defineProperty(I18nManager, 'isRTL', { configurable: true, value })
}

function StackHarness() {
  const router = useRouter()
  return <ThemedStack router={router} />
}

describe('root layout direction', () => {
  beforeEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('en')
    })
    setNativeRTL(false)
    mockCapture.screenOptions = undefined
    ;(Updates.reloadAsync as jest.Mock).mockClear()
  })

  afterAll(async () => {
    await act(async () => {
      await i18n.changeLanguage('en')
    })
    setNativeRTL(false)
  })

  it('paints the app root ltr for English and rtl for Hebrew, switching in place', async () => {
    const screen = await render(
      <DirectionRoot>
        <Text testID="child">child</Text>
      </DirectionRoot>,
    )
    const rootStyle = () =>
      StyleSheet.flatten(screen.getByTestId('child').parent?.props.style)

    expect(rootStyle()).toEqual(expect.objectContaining({ direction: 'ltr' }))

    await act(async () => {
      await i18n.changeLanguage('he')
    })

    expect(rootStyle()).toEqual(expect.objectContaining({ direction: 'rtl' }))
    expect(Updates.reloadAsync).not.toHaveBeenCalled()
  })

  it('paints the root from i18next even when the native RTL state disagrees', async () => {
    setNativeRTL(true)
    await act(async () => {
      await i18n.changeLanguage('en')
    })

    const screen = await render(
      <DirectionRoot>
        <Text testID="child">child</Text>
      </DirectionRoot>,
    )

    expect(I18nManager.isRTL).toBe(true)
    expect(
      StyleSheet.flatten(screen.getByTestId('child').parent?.props.style),
    ).toEqual(expect.objectContaining({ direction: 'ltr' }))
  })

  it('picks the stack push animation from i18next, not from native RTL state', async () => {
    setNativeRTL(true)
    await render(<StackHarness />)
    expect(mockCapture.screenOptions?.animation).toBeUndefined()

    setNativeRTL(false)
    await act(async () => {
      await i18n.changeLanguage('ar')
    })
    await render(<StackHarness />)
    expect(mockCapture.screenOptions?.animation).toBe('slide_from_left')
  })
})
