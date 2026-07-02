/**
 * SessionScreen — hard-stop button (#173).
 *
 * Guards: the stop button shows only while the PTY is live (running /
 * waiting_input), confirming its Alert fires the stopSession mutation, and it
 * is hidden once the session is idle.
 */
import React from 'react'
import { Alert } from 'react-native'
import { render, screen, fireEvent } from '@testing-library/react-native'
import { createWrapper } from '@/test-utils'

// Mutable so individual tests can vary the session status the screen sees.
let mockStatus: 'running' | 'waiting_input' | 'idle' = 'waiting_input'
const mockStopMutate = jest.fn()

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
    adoptSession: { mutate: jest.fn() },
    stopSession: { mutate: mockStopMutate, isPending: false },
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
}))
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}))

// eslint-disable-next-line import/first
import SessionDetailScreen from '@/app/session/[id]'

describe('SessionScreen — hard-stop button', () => {
  beforeEach(() => {
    mockStatus = 'waiting_input'
    mockStopMutate.mockClear()
  })

  it('renders the stop button while the session is live', () => {
    render(<SessionDetailScreen />, { wrapper: createWrapper() })
    expect(screen.getByTestId('session-stop-button')).toBeTruthy()
  })

  it('confirming the stop dialog fires the stopSession mutation', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    render(<SessionDetailScreen />, { wrapper: createWrapper() })

    fireEvent.press(screen.getByTestId('session-stop-button'))
    expect(alertSpy).toHaveBeenCalledTimes(1)

    // Pull the confirm button out of the Alert's button array and invoke it.
    const buttons = alertSpy.mock.calls[0][2] ?? []
    const confirm = buttons.find((b) => b.style !== 'cancel')
    confirm?.onPress?.()

    expect(mockStopMutate).toHaveBeenCalledTimes(1)
    alertSpy.mockRestore()
  })

  it('hides the stop button once the session is idle', () => {
    mockStatus = 'idle'
    render(<SessionDetailScreen />, { wrapper: createWrapper() })
    expect(screen.queryByTestId('session-stop-button')).toBeNull()
  })
})
