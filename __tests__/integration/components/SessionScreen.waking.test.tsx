/**
 * SessionScreen — waking-up overlay backstop.
 *
 * The 🤖 waking-up overlay (main live path, isWakingUp) clears only when a WS
 * session_update pushes status → waiting_input. There is no polling on the
 * session query, so a dropped/stranded session_update would leave the overlay
 * stuck indefinitely. Guard: after WAKING_UP_BACKSTOP_MS (15s) still waking,
 * the screen re-pulls the session over HTTP (invalidateQueries) and forces a
 * WS reconnect so the overlay always resolves.
 */
import React from 'react'
import { render, act, cleanup } from '@testing-library/react-native'
import { createWrapper } from '@/test-utils'

const mockInvalidate = jest.fn()
const mockForceReconnect = jest.fn()

// Live, still-waking session: running + ptyAttached, no prompt reached yet.
const mockWakingSession = {
  id: 'sess-real-id',
  status: 'running',
  ptyAttached: true,
  promptCount: 0,
  elapsedMs: 0,
  conversationId: undefined,
  boundConversationId: undefined,
}

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
jest.mock('@/components/terminal/TerminalView', () => ({ TerminalView: () => null }))
jest.mock('@/components/terminal/MatrixRain', () => ({ MatrixRain: () => null }))
jest.mock('@/hooks/useSession', () => ({
  useSessionDetail: () => ({ data: mockWakingSession, isLoading: false }),
}))
jest.mock('@/hooks/useSessionActions', () => ({
  useSessionActions: () => ({
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
    getClient: () => ({ on: jest.fn(() => jest.fn()) }),
    // Wrapped in an arrow so the mockForceReconnect binding is resolved at call
    // time, not when this factory runs (it can run before the const inits via a
    // transitive @/test-utils import → TDZ → undefined property otherwise).
    forceReconnect: (...args: unknown[]) => mockForceReconnect(...args),
    send: jest.fn(),
    status: () => 'connected',
    onAnyStatusChange: () => () => {},
  },
}))
jest.mock('@/stores/servers', () => ({
  useServersStore: (sel: (s: { activeServerIds: string[] }) => unknown) =>
    sel({ activeServerIds: ['srv1'] }),
}))
jest.mock('@/stores/loading-state', () => ({ useLoadingStateStore: () => 0 }))
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
jest.mock('@/hooks/useSessionName', () => ({ useRenameSession: () => ({ mutate: jest.fn() }) }))
jest.mock('@/stores/settings', () => ({ useSettingsStore: () => ({ sessionView: 'chat' }) }))
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'sess-real-id', server: 'srv1' }),
  useRouter: () => ({ replace: jest.fn(), back: jest.fn(), push: jest.fn() }),
}))
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQueryClient: () => ({
    invalidateQueries: mockInvalidate,
    cancelQueries: jest.fn(),
    removeQueries: jest.fn(),
  }),
}))

// eslint-disable-next-line import/first
import SessionDetailScreen from '@/app/session/[id]'

describe('SessionScreen — waking-up backstop', () => {
  beforeEach(() => {
    mockInvalidate.mockClear()
    mockForceReconnect.mockClear()
  })

  afterEach(() => {
    cleanup()
    jest.useRealTimers()
  })

  it('re-pulls the session and reconnects after 15s still waking with no session_update', async () => {
    jest.useFakeTimers()
    await render(<SessionDetailScreen />, { wrapper: createWrapper() })

    // Before the backstop fires, no re-pull.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(14_000)
    })
    expect(mockInvalidate).not.toHaveBeenCalledWith({ queryKey: ['session', 'srv1', 'sess-real-id'] })

    // After WAKING_UP_BACKSTOP_MS the overlay re-pulls status + forces reconnect.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(2_000)
    })
    expect(mockForceReconnect).toHaveBeenCalledWith('srv1')
    expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ['session', 'srv1', 'sess-real-id'] })
  })
})
