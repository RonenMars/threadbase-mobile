/**
 * SessionScreen — leave-session gate wiring (beforeRemove).
 * Policy details live in useSessionLeaveGuard unit tests; this file checks the
 * screen still registers the listener and that backgrounding is unchanged.
 */
import React from 'react'
import { AppState } from 'react-native'
import { render, screen, act } from '@testing-library/react-native'
import { usePreventRemove } from 'expo-router/react-navigation'
import { createWrapper } from '@/test-utils'
import { useSettingsStore } from '@/stores/settings'

let appStateListeners: ((s: string) => void)[] = []
let mockStarting: string | undefined
const fireAppState = (s: string) => appStateListeners.forEach((l) => l(s))

const mockSend = jest.fn()
const mockStopMutate = jest.fn()
const mockStopMutateAsync = jest.fn(() => Promise.resolve())
const mockDispatch = jest.fn()

let mockSession = {
  id: 'sess-live',
  ptyAttached: true,
  status: 'running' as string,
  conversationId: 'conv-1',
  projectName: 'my-project',
  promptCount: 3,
  elapsedMs: 5000,
  failureReason: null as string | null,
  resumedFromConversationId: null as string | null,
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
jest.mock('@/components/terminal/TerminalView', () => ({
  TerminalView: () => null,
}))
jest.mock('@/components/terminal/MatrixRain', () => ({ MatrixRain: () => null }))
jest.mock('@/hooks/useSession', () => ({
  useSessionDetail: () => ({ data: mockSession, isLoading: false }),
}))
jest.mock('@/hooks/useSessionActions', () => ({
  useSessionActions: () => ({
    sendInput: { mutate: jest.fn() },
    sendKeys: { mutate: jest.fn(), isPending: false },
    adoptSession: { mutate: jest.fn() },
    stopSession: { mutate: mockStopMutate, mutateAsync: mockStopMutateAsync, isPending: false },
  }),
}))
jest.mock('@/hooks/useTerminalStream', () => ({
  useTerminalStream: () => ({ lines: [], isStreaming: false, isLoadingHistory: false, clear: jest.fn() }),
}))
jest.mock('@/services/ws-client', () => ({
  wsManager: {
    getClient: () => null,
    forceReconnect: jest.fn(),
    send: (...args: unknown[]) => mockSend(...args),
    status: () => 'connected',
    onAnyStatusChange: () => () => {},
    holdSessionWaitingInput: jest.fn(() => Promise.resolve({ ok: true })),
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
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'sess-live', server: 'srv1', starting: mockStarting }),
  useRouter: () => ({ replace: jest.fn(), back: jest.fn() }),
  useNavigation: () => ({
    setOptions: jest.fn(),
    dispatch: (...args: unknown[]) => mockDispatch(...args),
  }),
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

describe('SessionScreen — leave-session gate', () => {
  beforeEach(() => {
    ;(usePreventRemove as jest.Mock).mockClear()
    appStateListeners = []
    mockStarting = undefined
    mockSend.mockClear()
    mockStopMutate.mockClear()
    mockStopMutateAsync.mockClear()
    mockDispatch.mockClear()
    mockSession = {
      id: 'sess-live',
      ptyAttached: true,
      status: 'running',
      conversationId: 'conv-1',
      projectName: 'my-project',
      promptCount: 3,
      elapsedMs: 5000,
      failureReason: null,
      resumedFromConversationId: null,
    }
    useSettingsStore.setState({ sessionLeaveAction: 'ask', sessionView: 'chat' })
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, cb) => {
      appStateListeners.push(cb as (s: string) => void)
      return { remove: jest.fn() } as ReturnType<typeof AppState.addEventListener>
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('Always ask: back from a live session shows the modal', async () => {
    await render(<SessionDetailScreen />, { wrapper: createWrapper() })
    const [preventRemove, callback] = (usePreventRemove as jest.Mock).mock.calls.at(-1)
    expect(preventRemove).toBe(true)

    await act(() => {
      callback({ data: { action: { type: 'GO_BACK' } } })
    })

    expect(screen.getByTestId('leave-session-modal')).toBeTruthy()
    expect(mockStopMutate).not.toHaveBeenCalled()
  })

  it('Always ask: empty live session also shows the modal', async () => {
    mockSession = { ...mockSession, promptCount: 0 }
    await render(<SessionDetailScreen />, { wrapper: createWrapper() })

    const [, callback] = (usePreventRemove as jest.Mock).mock.calls.at(-1)
    await act(() => {
      callback({ data: { action: { type: 'GO_BACK' } } })
    })

    expect(screen.getByTestId('leave-session-modal')).toBeTruthy()
    expect(mockStopMutate).not.toHaveBeenCalled()
  })

  it('allows the automatic replacement that opens a resumed session', async () => {
    mockStarting = '1'
    await render(<SessionDetailScreen />, { wrapper: createWrapper() })

    const [, callback] = (usePreventRemove as jest.Mock).mock.calls.at(-1)
    await act(() => {
      callback({ data: { action: { type: 'REPLACE' } } })
    })

    expect(screen.queryByTestId('leave-session-modal')).toBeNull()
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'REPLACE' })
  })

  it('backgrounding still sends hold_session and does not show the leave modal', async () => {
    await render(<SessionDetailScreen />, { wrapper: createWrapper() })
    fireAppState('background')
    expect(mockSend).toHaveBeenCalledWith('srv1', { type: 'hold_session', sessionId: 'sess-live' })
    expect(screen.queryByTestId('leave-session-modal')).toBeNull()
    expect(mockStopMutate).not.toHaveBeenCalled()
  })
})
