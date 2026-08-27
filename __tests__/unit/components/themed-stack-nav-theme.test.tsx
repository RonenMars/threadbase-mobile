/**
 * Regression guard for the expo-router ≥57.0.3 native-container background.
 *
 * expo-router 57.0.3 started painting the native stack container
 * (UINavigationController's view on iOS) with the react-navigation theme's
 * `colors.background` (NativeStackView.native.js: `<ScreenStack
 * nativeContainerStyle={{ backgroundColor: colors.background }}>`). Without an
 * app-provided nav theme that falls back to DefaultTheme's opaque light grey
 * rgb(242,242,242), which covers the glass gradient backdrop rendered behind
 * the Stack in app/_layout.tsx.
 *
 * ThemedStack must therefore wrap the Stack in expo-router's ThemeProvider
 * with `colors.background` = 'transparent' under glass themes and
 * `theme.bg.primary` otherwise, on top of the base theme matching the app's
 * color mode.
 */
import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import type { NativeStackNavigationOptions } from 'expo-router'

import { ThemedStack } from '@/app/_layout'
import i18n from '@/lib/i18n'
import {
  dark,
  light,
  appleGlassThemes,
  type Theme,
} from '@/constants/theme'
import {
  useRouter,
  DefaultTheme as NavDefaultTheme,
  DarkTheme as NavDarkTheme,
} from 'expo-router'

type NavTheme = typeof NavDefaultTheme

const mockThemeState: { theme: Theme; isGlass: boolean } = {
  theme: dark,
  isGlass: false,
}

const mockCapture: {
  navTheme?: NavTheme
  screenOptions?: NativeStackNavigationOptions
  screenOptionsByName: Record<string, NativeStackNavigationOptions | undefined>
} = { screenOptionsByName: {} }

const mockStackRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  navigate: jest.fn(),
  canGoBack: jest.fn(() => true),
}

// Override the global jest.setup.js mock: tests here drive theme + glass mode.
jest.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => mockThemeState.theme,
  useIsGlass: () => mockThemeState.isGlass,
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// Override the global expo-router mock with a renderable Stack and a
// ThemeProvider that records the nav theme ThemedStack provides. DefaultTheme
// and DarkTheme are the real vendored react-navigation themes so the test
// breaks if upstream renames or reshapes them.
jest.mock('expo-router', () => {
  const ReactActual = require('react') as typeof React
  const { View } = require('react-native')
  const { DefaultTheme } = jest.requireActual(
    'expo-router/build/react-navigation/native/theming/DefaultTheme',
  )
  const { DarkTheme } = jest.requireActual(
    'expo-router/build/react-navigation/native/theming/DarkTheme',
  )
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
  Stack.Screen = ({
    name,
    options,
  }: {
    name: string
    options?: NativeStackNavigationOptions
  }) => {
    mockCapture.screenOptionsByName[name] = options
    return null
  }
  return {
    Stack,
    ThemeProvider: ({
      value,
      children,
    }: {
      value: NavTheme
      children: React.ReactNode
    }) => {
      mockCapture.navTheme = value
      return children
    },
    DefaultTheme,
    DarkTheme,
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
  const { View } = require('react-native')
  return {
    CaretLeft: (props: { mirrored?: boolean }) =>
      ReactActual.createElement(View, {
        testID: 'header-back-caret',
        mirrored: props.mirrored ?? false,
      }),
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
jest.mock('@/components/SplashAnimation', () => ({
  SplashAnimation: () => null,
}))

function Harness() {
  const router = useRouter()
  return <ThemedStack router={router} />
}

// RNTL v14 render is async-first: the tree flushes when the promise resolves.
async function renderThemedStack(theme: Theme, isGlass: boolean) {
  mockThemeState.theme = theme
  mockThemeState.isGlass = isGlass
  mockCapture.navTheme = undefined
  mockCapture.screenOptions = undefined
  mockCapture.screenOptionsByName = {}
  await render(<Harness />)
}

describe('ThemedStack nav theme (expo-router ≥57.0.3 container background)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    mockStackRouter.push.mockReset()
    mockStackRouter.replace.mockReset()
    mockStackRouter.back.mockReset()
    mockStackRouter.navigate.mockReset()
    mockStackRouter.canGoBack.mockReset()
    mockStackRouter.canGoBack.mockReturnValue(true)
  })

  it('provides a transparent nav background under a glass theme', async () => {
    await renderThemedStack(appleGlassThemes.aurora, true)

    expect(mockCapture.navTheme).toBeDefined()
    expect(mockCapture.navTheme?.colors.background).toBe('transparent')
    // aurora is a dark-mode theme → base must be the real DarkTheme
    expect(mockCapture.navTheme?.dark).toBe(true)
    expect(mockCapture.navTheme?.colors.text).toBe(NavDarkTheme.colors.text)
    // per-screen content must stay transparent so the gradient shows through
    expect(mockCapture.screenOptions?.contentStyle).toEqual({
      backgroundColor: 'transparent',
    })
  })

  it('provides theme.bg.primary on a dark non-glass theme', async () => {
    await renderThemedStack(dark, false)

    expect(mockCapture.navTheme?.colors.background).toBe(dark.bg.primary)
    expect(mockCapture.navTheme?.dark).toBe(true)
    expect(mockCapture.navTheme?.colors.text).toBe(NavDarkTheme.colors.text)
    expect(mockCapture.screenOptions?.contentStyle).toEqual({
      backgroundColor: dark.bg.primary,
    })
  })

  it('provides theme.bg.primary on a light non-glass theme', async () => {
    await renderThemedStack(light, false)

    expect(mockCapture.navTheme?.colors.background).toBe(light.bg.primary)
    expect(mockCapture.navTheme?.dark).toBe(false)
    expect(mockCapture.navTheme?.colors.text).toBe(NavDefaultTheme.colors.text)
  })

  // A closed-app OS-camera QR opens pairing as the only stack entry. The
  // native header used to call router.back() unconditionally and LogBox
  // "GO_BACK was not handled by any navigator".
  it('falls back to the hub from the native header when the stack cannot go back', async () => {
    mockStackRouter.canGoBack.mockReturnValue(false)
    await renderThemedStack(dark, false)

    const HeaderLeft = mockCapture.screenOptions?.headerLeft
    expect(HeaderLeft).toBeDefined()
    const { getByTestId } = await render(
      <>{HeaderLeft?.({ tintColor: '#fff', canGoBack: false })}</>,
    )
    fireEvent.press(getByTestId('header-back'))

    expect(mockStackRouter.back).not.toHaveBeenCalled()
    expect(mockStackRouter.replace).toHaveBeenCalledWith('/')
  })

  it('keeps the platform-default card transition in LTR', async () => {
    await renderThemedStack(dark, false)

    expect(mockCapture.screenOptions?.animation).toBeUndefined()
  })

  it('mirrors RTL card transitions without changing modal or gesture motion', async () => {
    await i18n.changeLanguage('he')
    await renderThemedStack(dark, false)

    expect(mockCapture.screenOptions?.animation).toBe('slide_from_left')
    expect(mockCapture.screenOptions?.gestureDirection).toBeUndefined()
    expect(mockCapture.screenOptions?.animationMatchesGesture).toBeUndefined()
    expect(mockCapture.screenOptionsByName.browse?.animation).toBe('default')
  })

  it('mirrors the native back caret in RTL and leaves it unmirrored in LTR', async () => {
    await renderThemedStack(dark, false)
    const HeaderLeftLtr = mockCapture.screenOptions?.headerLeft
    const ltr = await render(
      <>{HeaderLeftLtr?.({ tintColor: '#fff', canGoBack: true })}</>,
    )
    expect(ltr.getByTestId('header-back-caret').props.mirrored).toBe(false)

    await i18n.changeLanguage('he')
    await renderThemedStack(dark, false)
    const HeaderLeftRtl = mockCapture.screenOptions?.headerLeft
    const rtl = await render(
      <>{HeaderLeftRtl?.({ tintColor: '#fff', canGoBack: true })}</>,
    )
    expect(rtl.getByTestId('header-back-caret').props.mirrored).toBe(true)
  })

  it('translates the browse native title', async () => {
    await renderThemedStack(dark, false)
    expect(mockCapture.screenOptionsByName.browse?.title).toBe('Browse')
    expect(mockCapture.screenOptionsByName.browse?.headerBackTitle).toBe('Cancel')
  })
})
