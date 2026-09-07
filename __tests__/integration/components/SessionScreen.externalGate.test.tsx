/**
 * SessionScreen — DiscoveredSessionScreen gate (M/P3).
 *
 * The Overtake path (POST /adopt → SIGTERM the user's real terminal process) is
 * reachable only for a non-external discovered session. For an external session
 * it must be unreachable regardless of how the screen was navigated to.
 */
import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { createWrapper } from '@/test-utils'

// A mutable session the mocked useSessionDetail returns; each test sets it.
let mockSessionData: Record<string, unknown> | null = null

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
  useSessionDetail: () => ({ data: mockSessionData, isLoading: false }),
}))
jest.mock('@/hooks/useSessionActions', () => ({
  useSessionActions: () => ({
    setModel: { mutate: jest.fn(), error: null, isPending: false },
    setEffort: { mutate: jest.fn(), error: null, isPending: false },
    sendInput: { mutate: jest.fn() },
    adoptSession: { mutate: jest.fn(), isPending: false },
    sendKeys: { mutate: jest.fn(), isPending: false },
    stopSession: { mutate: jest.fn(), isPending: false },
  }),
}))
// The external case falls through the gate into the live PTY screen, which
// calls useTerminalStream unconditionally — stub it so the render settles.
jest.mock('@/hooks/useTerminalStream', () => ({
  useTerminalStream: () => ({
    lines: [],
    isStreaming: false,
    isLoadingHistory: false,
    clear: jest.fn(),
  }),
}))
jest.mock('@/services/ws-client', () => ({
  wsManager: {
    getClient: () => null,
    forceReconnect: jest.fn(),
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
  useLocalSearchParams: () => ({ id: 'sess-ext', server: 'srv1' }),
  useRouter: () => ({ replace: jest.fn(), back: jest.fn(), push: jest.fn() }),
  useNavigation: () => ({ setOptions: jest.fn(), addListener: jest.fn(() => jest.fn()) }),
}))
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}))

// eslint-disable-next-line import/first
import SessionDetailScreen from '@/app/session/[id]'

const baseSession = {
  id: 'sess-ext',
  projectName: 'my-project',
  projectPath: '/tmp/p',
  promptCount: 1,
  elapsedMs: 5000,
  failureReason: null,
  ptyAttached: false,
  status: 'running',
}

describe('SessionScreen — DiscoveredSessionScreen gate', () => {
  it('shows the Overtake screen for a managed discovered session', async () => {
    mockSessionData = { ...baseSession, ownership: 'managed' }
    await render(<SessionDetailScreen />, { wrapper: createWrapper() })
    expect(screen.getByText('Overtake')).toBeTruthy()
  })

  it('never shows the Overtake screen for an external session', async () => {
    mockSessionData = { ...baseSession, ownership: 'external' }
    await render(<SessionDetailScreen />, { wrapper: createWrapper() })
    expect(screen.queryByText('Overtake')).toBeNull()
  })
})
