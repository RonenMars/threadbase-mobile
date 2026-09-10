import React from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, render, waitFor } from '@testing-library/react-native'
import * as Notifications from 'expo-notifications'
import { AuthGate } from '@/app/_layout'
import { wsManager } from '@/services/ws-client'
import type { Session } from '@/types/api'

const mockReplace = jest.fn()
const mockPush = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
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
    retain: jest.fn(),
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

// #957: session_ready is broadcast to every device paired with the streamer, so
// the root listener must not navigate — only the device that started it does.
describe('AuthGate session_ready broadcast', () => {
  type OnAllHandler = Parameters<typeof wsManager.onAll>[1]
  type ResponseListener = (response: {
    notification: { request: { content: { data: { sessionId?: string; serverId?: string } } } }
  }) => void

  beforeEach(() => {
    jest.clearAllMocks()
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(null)
  })

  function capturedSessionReadyHandler(): OnAllHandler {
    const call = (wsManager.onAll as jest.Mock).mock.calls.find(([type]) => type === 'session_ready')
    if (!call) throw new Error('AuthGate did not subscribe to session_ready')
    return call[1] as OnAllHandler
  }

  it('does not navigate for a session this device did not start', async () => {
    await render(<AuthGate><></></AuthGate>)
    const onSessionReady = capturedSessionReadyHandler()

    await act(async () => {
      onSessionReady({
        type: 'session_ready',
        serverId: 'server-1',
        session: { id: 'sess_other_device', projectId: 'proj_1' } as Session,
      })
    })

    expect(mockPush).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalledWith(expect.stringContaining('/session/'))
  })

  it('positive control: the harness observes a push from a notification tap', async () => {
    await render(<AuthGate><></></AuthGate>)
    const listener = (Notifications.addNotificationResponseReceivedListener as jest.Mock).mock
      .calls[0][0] as ResponseListener

    await act(async () => {
      listener({
        notification: { request: { content: { data: { sessionId: 'sess_tap', serverId: 'server-1' } } } },
      })
    })

    expect(mockPush).toHaveBeenCalledWith('/session/sess_tap?server=server-1')
  })
})
