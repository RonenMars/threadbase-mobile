/**
 * SessionScreen — ended-session redirect.
 *
 * When a session has no live process (streamer `lifecycle` completed/failed/
 * resumable, or the legacy idle+detached pair on older servers) the screen
 * should open its conversation history if the session HAS a conversation.
 * The trigger is boundConversationId ?? conversationId, NOT promptCount —
 * promptCount counts only prompts sent through the app, so an adopted /
 * externally-started session with real history reads promptCount 0 and must
 * still redirect rather than strand on the read-only placeholder.
 */
import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import { createWrapper } from '@/test-utils'

const PLACEHOLDER_UUID = 'b80a4f91-17f4-4375-b65f-00e46c872b01'
const BOUND_ROLLOUT_UUID = '01a04720-4f11-4a2d-9e2d-b90e9c2d8c72'

const mockReplace = jest.fn()
let mockSessionData: Record<string, unknown>
let mockParams: Record<string, string>

// ── heavy native deps (mirrors SessionScreen.holdOnBackground.test.tsx) ───────
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
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ replace: mockReplace, back: jest.fn() }),
  useNavigation: () => ({ setOptions: jest.fn(), addListener: jest.fn(() => jest.fn()) }),
}))
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQueryClient: () => ({ invalidateQueries: jest.fn(), removeQueries: jest.fn() }),
}))

// eslint-disable-next-line import/first
import SessionDetailScreen from '@/app/session/[id]'

const endedSession = (overrides: Record<string, unknown>) => ({
  id: PLACEHOLDER_UUID,
  ptyAttached: false,
  status: 'idle',
  promptCount: 0,
  projectName: 'tb-mobile',
  projectPath: '/Users/ronenmars/dev/ai-tools/tb-mobile',
  elapsedMs: 35000,
  failureReason: null,
  ...overrides,
})

describe('SessionScreen — ended-session redirect', () => {
  beforeEach(() => {
    mockReplace.mockClear()
    mockParams = { id: PLACEHOLDER_UUID, server: 'srv1' }
  })

  it('redirects when lifecycle is completed and a conversationId is present', async () => {
    mockSessionData = endedSession({
      conversationId: PLACEHOLDER_UUID,
      promptCount: 0,
      lifecycle: 'completed',
    })
    await render(<SessionDetailScreen />, { wrapper: createWrapper() })
    expect(mockReplace).toHaveBeenCalledWith(`/conversation/${PLACEHOLDER_UUID}?server=srv1`)
  })

  it('redirects a held (resumable) session to conversation history for resume', async () => {
    mockSessionData = endedSession({
      conversationId: PLACEHOLDER_UUID,
      boundConversationId: BOUND_ROLLOUT_UUID,
      lifecycle: 'resumable',
      completedAt: '2026-08-01T00:00:00Z',
    })
    await render(<SessionDetailScreen />, { wrapper: createWrapper() })
    expect(mockReplace).toHaveBeenCalledWith(`/conversation/${BOUND_ROLLOUT_UUID}?server=srv1`)
  })

  it('redirects an ended codex session via boundConversationId instead of its placeholder', async () => {
    mockSessionData = endedSession({
      conversationId: PLACEHOLDER_UUID,
      boundConversationId: BOUND_ROLLOUT_UUID,
      promptCount: 0,
      lifecycle: 'completed',
    })
    await render(<SessionDetailScreen />, { wrapper: createWrapper() })
    expect(mockReplace).toHaveBeenCalledWith(`/conversation/${BOUND_ROLLOUT_UUID}?server=srv1`)
  })

  it('does NOT redirect when the ended session has no conversation at all', async () => {
    mockSessionData = endedSession({
      conversationId: null,
      boundConversationId: null,
      promptCount: 0,
      lifecycle: 'completed',
    })
    await render(<SessionDetailScreen />, { wrapper: createWrapper() })
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('falls back to idle+detached redirect when lifecycle is absent', async () => {
    mockSessionData = endedSession({ conversationId: PLACEHOLDER_UUID, promptCount: 0 })
    await render(<SessionDetailScreen />, { wrapper: createWrapper() })
    expect(mockReplace).toHaveBeenCalledWith(`/conversation/${PLACEHOLDER_UUID}?server=srv1`)
  })

  // A just-resumed session on an older server (no lifecycle) can read
  // idle+detached until its PTY attaches. Redirecting then bounced the user
  // straight back to the conversation they had just tapped Resume on.
  it('does NOT redirect a starting session that has not attached its PTY yet', async () => {
    mockParams = { id: PLACEHOLDER_UUID, server: 'srv1', starting: '1' }
    mockSessionData = endedSession({ conversationId: PLACEHOLDER_UUID, promptCount: 0 })
    await render(<SessionDetailScreen />, { wrapper: createWrapper() })
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('does NOT redirect an attached live session', async () => {
    mockSessionData = endedSession({
      conversationId: PLACEHOLDER_UUID,
      ptyAttached: true,
      status: 'waiting_input',
      lifecycle: 'attached',
    })
    await render(<SessionDetailScreen />, { wrapper: createWrapper() })
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('opens a detached codex session conversation via boundConversationId', async () => {
    mockSessionData = endedSession({
      conversationId: PLACEHOLDER_UUID,
      boundConversationId: BOUND_ROLLOUT_UUID,
      promptCount: 1,
      lifecycle: 'detached',
    })
    const root = await render(<SessionDetailScreen />, { wrapper: createWrapper() })

    fireEvent.press(root.getByText('Open Conversation'))

    expect(mockReplace).toHaveBeenCalledWith(`/conversation/${BOUND_ROLLOUT_UUID}?server=srv1`)
  })

  it('drops the starting screen once the PTY is attached', async () => {
    mockParams = { id: PLACEHOLDER_UUID, server: 'srv1', starting: '1' }
    mockSessionData = endedSession({
      conversationId: PLACEHOLDER_UUID,
      ptyAttached: true,
      status: 'waiting_input',
      lifecycle: 'attached',
    })
    const { queryByText } = await render(<SessionDetailScreen />, { wrapper: createWrapper() })
    expect(queryByText('Starting session…')).toBeNull()
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
