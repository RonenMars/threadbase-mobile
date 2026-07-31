/**
 * SessionScreen — pending session (start/resume ready-wait timeout).
 *
 * Guards: /session/pending_<id> shows progress while waiting for session_ready
 * or a ptyAttached session_update. After STUCK_AFTER_MS (20s) with neither,
 * it swaps to a stuck state offering "View console" (navigate to the real
 * session, unblocked from the streamer's own gate/ready fallbacks) and "Stop
 * session" (kills the still-starting PTY) instead of spinning forever.
 */
import React from 'react'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react-native'
import { createWrapper } from '@/test-utils'

let sessionReadyHandler: ((msg: unknown) => void) | undefined
let sessionUpdateHandler: ((msg: unknown) => void) | undefined
const mockOn = jest.fn((type: string, handler: (msg: unknown) => void) => {
  if (type === 'session_ready') sessionReadyHandler = handler
  if (type === 'session_update') sessionUpdateHandler = handler
  return jest.fn()
})

const mockReplace = jest.fn()
const mockBack = jest.fn()
const mockStopMutate = jest.fn()

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
  useSessionDetail: () => ({ data: undefined, isLoading: false }),
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
    getClient: () => ({ on: mockOn }),
    forceReconnect: jest.fn(),
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
  useLocalSearchParams: () => ({ id: 'pending_sess-real-id', server: 'srv1' }),
  useRouter: () => ({ replace: mockReplace, back: mockBack, push: jest.fn() }),
  useNavigation: () => ({ setOptions: jest.fn(), addListener: jest.fn(() => jest.fn()) }),
}))
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}))

// eslint-disable-next-line import/first
import SessionDetailScreen from '@/app/session/[id]'

/** Fresh fake clock per test — cumulative advances across tests were blanking the tree. */
function installPendingFakeTimers() {
  jest.useFakeTimers({ now: new Date('2024-01-01T00:00:00.000Z') })
}

describe('SessionScreen — pending session', () => {
  beforeEach(() => {
    sessionReadyHandler = undefined
    sessionUpdateHandler = undefined
    mockOn.mockClear()
    mockReplace.mockClear()
    mockBack.mockClear()
    mockStopMutate.mockClear()
  })

  afterEach(() => {
    // Each test mounts its own PendingSessionScreen instance, which starts a
    // real setInterval (phrase rotation + elapsed-time). Explicit unmount +
    // cleanup between tests so a prior test's interval can't fire mid-render
    // of the next one, and so fake timers (installed per-test below) start
    // from a clean slate.
    cleanup()
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  it('shows the starting state and navigates on session_ready', async () => {
    await render(<SessionDetailScreen />, { wrapper: createWrapper() })
    expect(screen.getByText('Starting session…')).toBeTruthy()

    await act(async () => {
      sessionReadyHandler?.({ type: 'session_ready', session: { id: 'sess-real-id' } })
    })

    expect(mockReplace).toHaveBeenCalledWith('/session/sess-real-id?server=srv1')
  })

  it('navigates on a ptyAttached session_update fallback', async () => {
    await render(<SessionDetailScreen />, { wrapper: createWrapper() })

    await act(async () => {
      sessionUpdateHandler?.({
        type: 'session_update',
        session: { id: 'sess-real-id', ptyAttached: true },
      })
    })

    expect(mockReplace).toHaveBeenCalledWith('/session/sess-real-id?server=srv1')
  })

  it('shows a stuck state with View console / Stop session after 20s with no signal', async () => {
    installPendingFakeTimers()
    await render(<SessionDetailScreen />, { wrapper: createWrapper() })

    await act(async () => {
      await jest.advanceTimersByTimeAsync(20_000)
    })

    expect(screen.queryByText('Starting session…')).toBeNull()
    expect(screen.getByText('Wait more')).toBeTruthy()
    const viewConsole = screen.getByText('View console')
    const stop = screen.getByText('Stop session')

    await act(async () => {
      fireEvent.press(viewConsole)
    })
    expect(mockReplace).toHaveBeenCalledWith('/session/sess-real-id?server=srv1')

    await act(async () => {
      fireEvent.press(stop)
    })
    expect(mockStopMutate).toHaveBeenCalled()
  })

  it('does not show the stuck state before 20s', async () => {
    installPendingFakeTimers()
    await render(<SessionDetailScreen />, { wrapper: createWrapper() })

    await act(async () => {
      await jest.advanceTimersByTimeAsync(19_000)
    })

    expect(screen.getByText('Starting session…')).toBeTruthy()
    expect(screen.queryByText('View console')).toBeNull()
  })

  it('"Wait more" dismisses the stuck state and returns to the spinner', async () => {
    installPendingFakeTimers()
    await render(<SessionDetailScreen />, { wrapper: createWrapper() })

    await act(async () => {
      await jest.advanceTimersByTimeAsync(20_000)
    })
    expect(screen.getByText('Wait more')).toBeTruthy()

    await act(async () => {
      fireEvent.press(screen.getByText('Wait more'))
    })
    // Let the re-armed 250ms interval tick once without re-entering stuck.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(250)
    })

    // Back to the spinner; stuck actions gone.
    expect(screen.getByText('Starting session…')).toBeTruthy()
    expect(screen.queryByText('Wait more')).toBeNull()
    expect(screen.queryByText('View console')).toBeNull()
  })
})
