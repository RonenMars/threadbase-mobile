import React from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { render, waitFor } from '@testing-library/react-native'
import { AuthGate } from '@/app/_layout'

const mockReplace = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace }),
  useSegments: () => ['onboarding'],
  useGlobalSearchParams: () => ({}),
  useRootNavigationState: () => ({ key: 'root' }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
  DefaultTheme: { colors: {} },
  DarkTheme: { colors: {} },
  Stack: Object.assign(() => null, { Screen: () => null }),
}))
jest.mock('@/stores/servers', () => {
  const state = {
    activeServerIds: ['server-1'],
    isLoading: false,
    servers: {
      'server-1': { id: 'server-1', url: 'http://localhost:8766', apiKey: 'token' },
    },
    loadPersistedServers: jest.fn(),
    setConnected: jest.fn(),
    setScanProgress: jest.fn(),
    setCacheAlert: jest.fn(),
    clearCacheAlert: jest.fn(),
    setHostPressure: jest.fn(),
    clearHostPressure: jest.fn(),
  }
  const useServersStore = Object.assign(
    (selector: (value: typeof state) => unknown) => selector(state),
    { getState: () => state },
  )
  return { useServersStore }
})
jest.mock('@/stores/settings', () => {
  const state = { hydrate: jest.fn().mockResolvedValue(undefined), locale: 'en' }
  const useSettingsStore = Object.assign(
    (selector: (value: typeof state) => unknown) => selector(state),
    { getState: () => state },
  )
  return { useSettingsStore }
})
jest.mock('@/stores/sessionNames', () => ({
  useSessionNamesStore: (selector: (state: { hydrate: () => Promise<void> }) => unknown) =>
    selector({ hydrate: jest.fn().mockResolvedValue(undefined) }),
}))
jest.mock('@/stores/quickAccess', () => ({
  useQuickAccessStore: (selector: (state: { hydrate: () => Promise<void> }) => unknown) =>
    selector({ hydrate: jest.fn().mockResolvedValue(undefined) }),
}))
jest.mock('@/stores/viewPrefs', () => ({
  useViewPrefsStore: (selector: (state: { hydrate: () => Promise<void> }) => unknown) =>
    selector({ hydrate: jest.fn().mockResolvedValue(undefined) }),
}))
jest.mock('@/services/ws-client', () => ({
  wsManager: {
    connect: jest.fn(),
    onAll: jest.fn(() => jest.fn()),
    onAnyStatusChange: jest.fn(() => jest.fn()),
    disconnectAll: jest.fn(),
  },
}))
jest.mock('@/services/push', () => ({ registerPushTokenForAll: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/services/live-activity', () => ({
  adoptRunningActivities: jest.fn().mockResolvedValue(undefined),
  reconcile: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/components/servers/CacheAlertSync', () => ({ CacheAlertSync: () => null }))

describe('AuthGate review reload bootstrap', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify({ step: 'welcome', mode: 'review' }),
    )
  })

  it('routes a paired reload back to onboarding review before the home redirect', async () => {
    render(<AuthGate><></></AuthGate>)

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/onboarding?mode=review')
    })
    expect(mockReplace).not.toHaveBeenCalledWith('/')
    expect(AsyncStorage.removeItem).not.toHaveBeenCalledWith('threadbase_onboarding_resume')
  })
})
