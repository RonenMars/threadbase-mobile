/**
 * SessionScreen — copy-transcript overflow item.
 *
 * Guards: "Copy all" lives in the header overflow menu (it used to be a
 * floating button inside TerminalOutput) and copies the same text the
 * terminal renders — wrapped user prompts collapsed, ANSI stripped. It is
 * disabled when the PTY stream has produced no lines.
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react-native'
import { createWrapper } from '@/test-utils'

// Mutable so individual tests can vary what the PTY stream has produced.
let mockLines: string[] = []
let mockUserMessageTexts = new Set<string>()
const mockSetStringAsync = jest.fn()

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
jest.mock('expo-clipboard', () => ({
  setStringAsync: (...args: unknown[]) => mockSetStringAsync(...args),
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
      status: 'waiting_input',
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
    sendKeys: { mutate: jest.fn(), isPending: false },
    adoptSession: { mutate: jest.fn() },
    stopSession: { mutate: jest.fn(), isPending: false },
  }),
}))
jest.mock('@/hooks/useTerminalStream', () => ({
  useTerminalStream: () => ({
    lines: mockLines,
    userMessageTexts: mockUserMessageTexts,
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

describe('SessionScreen — copy transcript', () => {
  beforeEach(() => {
    mockLines = []
    mockUserMessageTexts = new Set<string>()
    mockSetStringAsync.mockClear()
  })

  it('copies the collapsed, ANSI-stripped transcript from the overflow menu', async () => {
    mockLines = ['\x1b[32mhello\x1b[0m', '❯ do the', 'thing']
    mockUserMessageTexts = new Set(['do the thing'])
    await render(<SessionDetailScreen />, { wrapper: createWrapper() })

    await fireEvent.press(screen.getByTestId('session-overflow-menu'))
    await fireEvent.press(screen.getByTestId('terminal-copy-all'))

    expect(mockSetStringAsync).toHaveBeenCalledWith('hello\n❯ do the thing')
  })

  it('disables the copy item while the stream has no lines', async () => {
    await render(<SessionDetailScreen />, { wrapper: createWrapper() })

    await fireEvent.press(screen.getByTestId('session-overflow-menu'))
    await fireEvent.press(screen.getByTestId('terminal-copy-all'))

    expect(mockSetStringAsync).not.toHaveBeenCalled()
  })
})
