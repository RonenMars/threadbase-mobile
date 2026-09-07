/**
 * SessionScreen — hold-on-background.
 *
 * Guards: when the app goes to background, the screen proactively sends a
 * { type: 'hold_session', sessionId } WS message so the server (re)arms its
 * ~4.5-min grace timer for this session, same as a WS disconnect would — the
 * session keeps running until the timer elapses. Returning to 'active'
 * force-reconnects (which re-subscribes and resumes). No message is sent for
 * other transitions (e.g. 'inactive').
 */
import React from 'react'
import { AppState } from 'react-native'
import { render } from '@testing-library/react-native'
import { createWrapper } from '@/test-utils'

// Capture every AppState 'change' listener so tests can drive transitions. The
// component imports AppState from 'react-native' (mocked by jest-expo), so we
// spy on the real object's addEventListener rather than replacing the module.
// Several hooks on the screen register their own 'change' listeners, so we
// collect all of them and fan a transition out to each (only the session
// screen's reacts to the WS in the ways we assert).
let appStateListeners: ((s: string) => void)[] = []
const fireAppState = (s: string) => appStateListeners.forEach((l) => l(s))

const mockSend = jest.fn()
const mockForceReconnect = jest.fn()

// ── heavy native deps (mirrors SessionScreen.stopButton.test.tsx) ─────────────
jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: false }),
    getPermissionsAsync: jest.fn().mockResolvedValue({ granted: false }),
    start: jest.fn(),
    stop: jest.fn(),
  },
  useSpeechRecognitionEvent: jest.fn(),
}))
jest.mock('@/components/conversation/LiveConversationView', () => ({
  LiveConversationView: () => null,
}))
jest.mock('@/components/terminal/TerminalView', () => ({
  TerminalView: () => null,
}))
jest.mock('@/components/terminal/MatrixRain', () => ({ MatrixRain: () => null }))
jest.mock('@/hooks/useSession', () => ({
  useSessionDetail: () => ({
    data: {
      id: 'sess-live',
      ptyAttached: true,
      status: 'running',
      conversationId: 'conv-1',
      projectName: 'my-project',
      promptCount: 3,
      elapsedMs: 5000,
      failureReason: null,
    },
    isLoading: false,
  }),
}))
jest.mock('@/hooks/useSessionActions', () => ({
  useSessionActions: () => ({
    setModel: { mutate: jest.fn(), error: null, isPending: false },
    setEffort: { mutate: jest.fn(), error: null, isPending: false },
    sendInput: { mutate: jest.fn() },
    sendKeys: { mutate: jest.fn(), isPending: false },
    adoptSession: { mutate: jest.fn() },
    stopSession: { mutate: jest.fn(), isPending: false },
  }),
}))
jest.mock('@/hooks/useTerminalStream', () => ({
  useTerminalStream: () => ({ lines: [], isStreaming: false, isLoadingHistory: false, clear: jest.fn() }),
}))
jest.mock('@/services/ws-client', () => ({
  wsManager: {
    getClient: () => null,
    forceReconnect: (...args: unknown[]) => mockForceReconnect(...args),
    send: (...args: unknown[]) => mockSend(...args),
    status: () => 'connected',
    onAnyStatusChange: () => () => {},
  },
}))
jest.mock('@/stores/servers', () => ({
  useServersStore: (sel: (s: { activeServerIds: string[] }) => unknown) =>
    sel({ activeServerIds: ['srv1'] }),
}))
jest.mock('@/stores/loading-state', () => ({
  useLoadingStateStore: () => 0,
}))
jest.mock('@/stores/sessionNames', () => ({
  useSessionNamesStore: (sel: (s: { getName: () => undefined }) => unknown) =>
    sel({ getName: () => undefined }),
}))
jest.mock('@/stores/quickAccess', () => {
  const store = { favorites: [], pinItem: jest.fn(), unpinItem: jest.fn() }
  return {
    useQuickAccessStore: (sel?: (s: typeof store) => unknown) => (sel ? sel(store) : store),
    buildFavoriteId: () => 'fav-id',
  }
})
jest.mock('@/hooks/useSessionName', () => ({
  useRenameSession: () => ({ mutate: jest.fn() }),
}))
jest.mock('@/stores/settings', () => ({
  useSettingsStore: () => ({ sessionView: 'chat' }),
}))
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'sess-live', server: 'srv1' }),
  useRouter: () => ({ replace: jest.fn(), back: jest.fn() }),
  useNavigation: () => ({ setOptions: jest.fn(), addListener: jest.fn(() => jest.fn()) }),
}))
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQueryClient: () => ({
    invalidateQueries: jest.fn(),
    getQueryData: jest.fn(),
  }),
}))

// eslint-disable-next-line import/first
import SessionDetailScreen from '@/app/session/[id]'

describe('SessionScreen — hold-on-background', () => {
  beforeEach(() => {
    appStateListeners = []
    mockSend.mockClear()
    mockForceReconnect.mockClear()
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, cb) => {
      appStateListeners.push(cb as (s: string) => void)
      return { remove: jest.fn() } as ReturnType<typeof AppState.addEventListener>
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('sends hold_session when the app goes to background', async () => {
    await render(<SessionDetailScreen />, { wrapper: createWrapper() })
    expect(appStateListeners.length).toBeGreaterThan(0)

    fireAppState('background')

    expect(mockSend).toHaveBeenCalledWith('srv1', { type: 'hold_session', sessionId: 'sess-live' })
    expect(mockForceReconnect).not.toHaveBeenCalled()
  })

  it('force-reconnects (does not hold) when the app returns to active', async () => {
    await render(<SessionDetailScreen />, { wrapper: createWrapper() })

    fireAppState('active')

    expect(mockForceReconnect).toHaveBeenCalledWith('srv1')
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('does nothing to the WS on an inactive transition', async () => {
    await render(<SessionDetailScreen />, { wrapper: createWrapper() })

    fireAppState('inactive')

    expect(mockSend).not.toHaveBeenCalled()
    expect(mockForceReconnect).not.toHaveBeenCalled()
  })
})
