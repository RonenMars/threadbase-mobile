/**
 * SessionScreen — ended-session redirect.
 *
 * When a session has ended (ptyAttached:false, status:'idle') the screen should
 * open its conversation history if the session HAS a conversation. The trigger
 * is boundConversationId ?? conversationId, NOT promptCount — promptCount counts
 * only prompts sent through the app, so an adopted / externally-started session
 * with real history reads promptCount 0 and must still redirect rather than
 * strand on the read-only "Running in another terminal" placeholder.
 */
import React from 'react'
import { render } from '@testing-library/react-native'
import { createWrapper } from '@/test-utils'

const SESSION_UUID = 'b80a4f91-17f4-4375-b65f-00e46c872b01'

const mockReplace = jest.fn()
let mockSessionData: Record<string, unknown>

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
  useLocalSearchParams: () => ({ id: 'b80a4f91-17f4-4375-b65f-00e46c872b01', server: 'srv1' }),
  useRouter: () => ({ replace: mockReplace, back: jest.fn() }),
}))
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQueryClient: () => ({ invalidateQueries: jest.fn(), removeQueries: jest.fn() }),
}))

// eslint-disable-next-line import/first
import SessionDetailScreen from '@/app/session/[id]'

const endedSession = (overrides: Record<string, unknown>) => ({
  id: SESSION_UUID,
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
  })

  it('redirects to the conversation when the ended session has a conversationId, even with promptCount 0', async () => {
    mockSessionData = endedSession({ conversationId: SESSION_UUID, promptCount: 0 })
    await render(<SessionDetailScreen />, { wrapper: createWrapper() })
    expect(mockReplace).toHaveBeenCalledWith(`/conversation/${SESSION_UUID}?server=srv1`)
  })

  it('redirects via boundConversationId (codex) even without conversationId', async () => {
    mockSessionData = endedSession({ boundConversationId: SESSION_UUID, conversationId: null, promptCount: 0 })
    await render(<SessionDetailScreen />, { wrapper: createWrapper() })
    expect(mockReplace).toHaveBeenCalledWith(`/conversation/${SESSION_UUID}?server=srv1`)
  })

  it('does NOT redirect when the ended session has no conversation at all', async () => {
    mockSessionData = endedSession({ conversationId: null, boundConversationId: null, promptCount: 0 })
    await render(<SessionDetailScreen />, { wrapper: createWrapper() })
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
