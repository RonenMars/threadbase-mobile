/**
 * SessionScreen — leave-session gate wiring (beforeRemove + unused discard).
 * Policy details live in useSessionLeaveGuard unit tests; this file checks the
 * screen still registers the listener and that backgrounding is unchanged.
 */
import React from 'react'
import { AppState } from 'react-native'
import { render, screen, act } from '@testing-library/react-native'
import { createWrapper } from '@/test-utils'
import { useSettingsStore } from '@/stores/settings'
import { clearSessionLeaveInFlight } from '@/lib/sessionLeavePolicy'
import { clearSessionUsed } from '@/lib/sessionUsage'

let beforeRemoveListener: ((e: { preventDefault: () => void; data: { action: object } }) => void) | undefined
let appStateListeners: ((s: string) => void)[] = []
const fireAppState = (s: string) => appStateListeners.forEach((l) => l(s))

const mockSend = jest.fn()
const mockStopMutate = jest.fn()
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
    stopSession: { mutate: mockStopMutate, isPending: false },
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
  useLocalSearchParams: () => ({ id: 'sess-live', server: 'srv1' }),
  useRouter: () => ({ replace: jest.fn(), back: jest.fn() }),
  useNavigation: () => ({
    setOptions: jest.fn(),
    addListener: (_event: string, cb: typeof beforeRemoveListener) => {
      beforeRemoveListener = cb
      return jest.fn()
    },
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
    beforeRemoveListener = undefined
    appStateListeners = []
    mockSend.mockClear()
    mockStopMutate.mockClear()
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
    clearSessionUsed('sess-live')
    clearSessionLeaveInFlight('sess-live')
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
    expect(beforeRemoveListener).toBeDefined()

    const preventDefault = jest.fn()
    await act(() => {
      beforeRemoveListener?.({ preventDefault, data: { action: { type: 'GO_BACK' } } })
    })

    expect(preventDefault).toHaveBeenCalled()
    expect(screen.getByTestId('leave-session-modal')).toBeTruthy()
    expect(mockStopMutate).not.toHaveBeenCalled()
  })

  it('promptCount === 0 unused discard still POSTs stop with no modal', async () => {
    mockSession = { ...mockSession, promptCount: 0 }
    await render(<SessionDetailScreen />, { wrapper: createWrapper() })

    const preventDefault = jest.fn()
    await act(() => {
      beforeRemoveListener?.({ preventDefault, data: { action: { type: 'GO_BACK' } } })
    })

    expect(preventDefault).not.toHaveBeenCalled()
    expect(screen.queryByTestId('leave-session-modal')).toBeNull()
    expect(mockStopMutate).toHaveBeenCalled()
  })

  it('backgrounding still sends hold_session and does not show the leave modal', async () => {
    await render(<SessionDetailScreen />, { wrapper: createWrapper() })
    fireAppState('background')
    expect(mockSend).toHaveBeenCalledWith('srv1', { type: 'hold_session', sessionId: 'sess-live' })
    expect(screen.queryByTestId('leave-session-modal')).toBeNull()
    expect(mockStopMutate).not.toHaveBeenCalled()
  })
})
