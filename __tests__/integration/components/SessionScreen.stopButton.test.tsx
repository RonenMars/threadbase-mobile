/**
 * SessionScreen — stop-response button.
 *
 * Guards: the stop button shows while the agent is actively responding
 * (status running) or while output is actively streaming. Pressing it sends
 * Esc to interrupt the response without killing the PTY session. It is
 * hidden once idle/waiting-for-input with nothing streaming. (Cancelling a
 * pending question/permission prompt is a separate action on the question
 * card itself — see QuestionCard.test.tsx.)
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react-native'
import { createWrapper } from '@/test-utils'

// Mutable so individual tests can vary the session status the screen sees.
let mockStatus: 'running' | 'waiting_input' | 'idle' = 'running'
const mockSendKeysMutate = jest.fn()
// Mutable so individual tests can vary streaming state independent of status.
let mockIsStreaming = false

// ── heavy native deps ────────────────────────────────────────────────────────
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
      status: mockStatus,
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
    sendInput: { mutate: jest.fn() },
    sendKeys: { mutate: mockSendKeysMutate, isPending: false },
    adoptSession: { mutate: jest.fn() },
    stopSession: { mutate: jest.fn(), isPending: false },
  }),
}))
jest.mock('@/hooks/useTerminalStream', () => ({
  useTerminalStream: () => ({ lines: [], isStreaming: mockIsStreaming, isLoadingHistory: false, clear: jest.fn() }),
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
    useQuickAccessStore: (sel?: (s: typeof store) => unknown) => sel ? sel(store) : store,
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
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}))

// eslint-disable-next-line import/first
import SessionDetailScreen from '@/app/session/[id]'

describe('SessionScreen — stop-response button', () => {
  beforeEach(() => {
    mockStatus = 'running'
    mockIsStreaming = false
    mockSendKeysMutate.mockClear()
  })

  it('renders the stop button while the agent is responding', async () => {
    await render(<SessionDetailScreen />, { wrapper: createWrapper() })
    expect(screen.getByTestId('session-stop-button')).toBeTruthy()
  })

  it('pressing stop sends Esc instead of killing the session', async () => {
    await render(<SessionDetailScreen />, { wrapper: createWrapper() })

    await fireEvent.press(screen.getByTestId('session-stop-button'))

    expect(mockSendKeysMutate).toHaveBeenCalledTimes(1)
    expect(mockSendKeysMutate.mock.calls[0][0]).toBe('\x1b')
  })

  it('hides the stop button while waiting for input', async () => {
    mockStatus = 'waiting_input'
    await render(<SessionDetailScreen />, { wrapper: createWrapper() })
    expect(screen.queryByTestId('session-stop-button')).toBeNull()
  })

  it('hides the stop button once the session is idle', async () => {
    mockStatus = 'idle'
    await render(<SessionDetailScreen />, { wrapper: createWrapper() })
    expect(screen.queryByTestId('session-stop-button')).toBeNull()
  })

  it('shows the stop button when output is streaming even if status is not running', async () => {
    mockStatus = 'waiting_input'
    mockIsStreaming = true
    await render(<SessionDetailScreen />, { wrapper: createWrapper() })
    expect(screen.getByTestId('session-stop-button')).toBeTruthy()
  })
})
