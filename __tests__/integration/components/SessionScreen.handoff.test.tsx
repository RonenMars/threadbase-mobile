/**
 * SessionScreen — "Hand off to Terminal" overflow item.
 *
 * Guards: the item shows only for a live, Threadbase-owned session on a server
 * that advertises `handoff`; the confirmation warns about the interrupted turn
 * only while one is running; and each server error code maps to its own copy.
 */
import React from 'react'
import { Alert } from 'react-native'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { createWrapper } from '@/test-utils'
import { NetworkError, NotFoundError } from '@/services/api-client'
import type { ServerInfo } from '@/types/api'

let mockServerInfo: Pick<ServerInfo, 'handoff'> | undefined
let mockStatus: 'waiting_input' | 'running' | 'idle' = 'waiting_input'
let mockOwnership: 'external' | undefined
const mockHandoff = jest.fn()
const mockReplace = jest.fn()

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
      ownership: mockOwnership,
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
    stopWhenIdle: { mutateAsync: jest.fn() },
    handoff: { mutateAsync: mockHandoff },
  }),
}))
jest.mock('@/hooks/useTerminalStream', () => ({
  useTerminalStream: () => ({
    lines: [],
    userMessageTexts: new Set<string>(),
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
    reconnectAttempt: () => 0,
    onAnyReconnectAttempt: () => () => {},
    isSessionAcquired: () => false,
  },
}))
jest.mock('@/stores/servers', () => ({
  useServersStore: (sel: (s: { activeServerIds: string[]; servers: Record<string, object> }) => unknown) =>
    sel({ activeServerIds: ['srv1'], servers: { srv1: { url: 'http://mac.local', label: 'My Mac', serverInfo: mockServerInfo } } }),
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
  useRouter: () => ({ replace: mockReplace, back: jest.fn() }),
  useNavigation: () => ({ setOptions: jest.fn(), addListener: jest.fn(() => jest.fn()) }),
}))
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}))

// eslint-disable-next-line import/first
import SessionDetailScreen from '@/app/session/[id]'

const HANDOFF = { openTerminal: false }

async function openMenu() {
  await render(<SessionDetailScreen />, { wrapper: createWrapper() })
  await fireEvent.press(screen.getByTestId('session-overflow-menu'))
}

async function confirmHandoff() {
  await openMenu()
  await fireEvent.press(screen.getByTestId('session-handoff'))
  await fireEvent.press(screen.getByTestId('session-handoff-confirm'))
}

describe('SessionScreen — hand off to terminal', () => {
  let alertSpy: jest.SpyInstance

  beforeEach(() => {
    mockServerInfo = { handoff: HANDOFF }
    mockStatus = 'waiting_input'
    mockOwnership = undefined
    mockHandoff.mockReset()
    mockReplace.mockClear()
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  })

  afterEach(() => {
    alertSpy.mockRestore()
  })

  it('is hidden when the server does not advertise handoff', async () => {
    mockServerInfo = {}
    await openMenu()
    expect(screen.getByTestId('session-end-terminate')).toBeTruthy()
    expect(screen.queryByTestId('session-handoff')).toBeNull()
  })

  it('is hidden for an external session', async () => {
    mockOwnership = 'external'
    await openMenu()
    expect(screen.queryByTestId('session-handoff')).toBeNull()
  })

  it('is hidden for a session that is no longer live', async () => {
    mockStatus = 'idle'
    await openMenu()
    expect(screen.getByTestId('session-raw-keys')).toBeTruthy()
    expect(screen.queryByTestId('session-handoff')).toBeNull()
  })

  it('names the server and omits the interrupt warning while waiting for input', async () => {
    await openMenu()
    await fireEvent.press(screen.getByTestId('session-handoff'))
    expect(screen.getByText('Threadbase stops this session and resumes it in tmux on My Mac.')).toBeTruthy()
    expect(screen.queryByTestId('session-handoff-interrupt')).toBeNull()
  })

  it('warns that the current turn is interrupted while running', async () => {
    mockStatus = 'running'
    await openMenu()
    await fireEvent.press(screen.getByTestId('session-handoff'))
    expect(screen.getByText('The current turn will be interrupted.')).toBeTruthy()
  })

  it('calls the handoff mutation on confirm, shows the attach command, and goes home on close', async () => {
    mockHandoff.mockResolvedValue({
      status: 'handed_off',
      tmuxSession: 'threadbase',
      window: 'my-project-sess-l',
      attachCommand: 'tmux attach -t threadbase',
    })
    await confirmHandoff()

    expect(mockHandoff).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('session-handoff-dialog')).toBeNull()
    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith('Moved to tmux', 'Attach with tmux attach -t threadbase', [
        expect.objectContaining({ text: 'Close' }),
      ]),
    )
    expect(mockReplace).not.toHaveBeenCalledWith('/')
    alertSpy.mock.calls[0][2][0].onPress()
    expect(mockReplace).toHaveBeenCalledWith('/')
  })

  it.each([
    ['HANDOFF_LAUNCH_FAILED', "Stopped here, but tmux didn't start — resume it from the app."],
    ['HANDOFF_KILL_TIMEOUT', "The session didn't stop, so it wasn't moved."],
    ['NOTHING_TO_RESUME', "Send a message first — there's nothing to resume yet."],
    ['NO_PID', "Couldn't hand off the session. Try again."],
    [undefined, "Couldn't hand off the session. Try again."],
  ])('maps error code %s to its copy', async (code, message) => {
    mockHandoff.mockRejectedValue(new NetworkError('refused', code, undefined, 409))
    await confirmHandoff()
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Hand off to Terminal', message))
  })

  it('stays silent on a 404, since the session is already gone', async () => {
    mockHandoff.mockRejectedValue(new NotFoundError('/api/sessions/sess-live/handoff'))
    await confirmHandoff()
    await waitFor(() => expect(mockHandoff).toHaveBeenCalledTimes(1))
    expect(alertSpy).not.toHaveBeenCalled()
  })
})
