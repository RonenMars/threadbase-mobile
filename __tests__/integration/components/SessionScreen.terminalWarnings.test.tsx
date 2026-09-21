/**
 * SessionScreen — terminal warnings.
 *
 * Guards: the two RAW-terminal notes are warnings, so they sit behind the
 * header bell and the Status sheet instead of taking transcript height above
 * a question card. They clear when the screen leaves.
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react-native'
import { createWrapper } from '@/test-utils'
import { useAlertStore } from '@/stores/alerts'
import { useErrorSheetStore } from '@/stores/errorSheet'

// Mutable so individual tests can vary what the stream reports.
let mockParseConfidence: 'high' | 'low' = 'high'
// Mutable so a test can have the chat view ask for the raw terminal.
let mockPreferRaw = false

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
jest.mock('@/components/conversation/LiveConversationView', () => {
  const { useEffect } = jest.requireActual('react')
  return {
    LiveConversationView: ({ onPreferRawTerminal }: { onPreferRawTerminal?: () => void }) => {
      useEffect(() => {
        if (mockPreferRaw) onPreferRawTerminal?.()
      }, [onPreferRawTerminal])
      return null
    },
  }
})
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
    setModel: { mutate: jest.fn(), error: null, isPending: false },
    setEffort: { mutate: jest.fn(), error: null, isPending: false },
    sendInput: { mutate: jest.fn() },
    sendKeys: { mutate: jest.fn(), isPending: false },
    adoptSession: { mutate: jest.fn() },
    stopSession: { mutate: jest.fn(), isPending: false },
  }),
}))
jest.mock('@/hooks/useTerminalStream', () => ({
  useTerminalStream: () => ({
    lines: [],
    isStreaming: false,
    isLoadingHistory: false,
    clear: jest.fn(),
    parseConfidence: mockParseConfidence,
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

const warningTitles = () =>
  useAlertStore.getState().alerts.filter((a) => a.level === 'warning').map((a) => a.title)

describe('SessionScreen — terminal warnings', () => {
  beforeEach(() => {
    mockParseConfidence = 'high'
    mockPreferRaw = false
    useAlertStore.getState().reset()
    useErrorSheetStore.getState().closeSheet()
  })

  it('shows no bell while the output parses cleanly', async () => {
    await render(<SessionDetailScreen />, { wrapper: createWrapper() })
    expect(screen.queryByTestId('status-pill')).toBeNull()
    expect(warningTitles()).toEqual([])
  })

  it('puts the RAW-mode note behind the header bell instead of inline', async () => {
    mockParseConfidence = 'low'
    await render(<SessionDetailScreen />, { wrapper: createWrapper() })

    expect(warningTitles()).toEqual(['RAW terminal mode — unsupported sequences detected; output is unfiltered.'])
    expect(screen.queryByText(/RAW terminal mode/)).toBeNull()

    await fireEvent.press(screen.getByTestId('status-pill'))
    expect(useErrorSheetStore.getState().open).toBe(true)
  })

  it('puts the forced-terminal note behind the bell instead of inline', async () => {
    mockPreferRaw = true
    await render(<SessionDetailScreen />, { wrapper: createWrapper() })

    expect(warningTitles()).toEqual(['Terminal'])
    expect(screen.getByTestId('status-pill')).toBeTruthy()
    expect(screen.queryByText(/before conversation messages are available/)).toBeNull()
  })

  it('clears the warning when the screen unmounts', async () => {
    mockParseConfidence = 'low'
    const { unmount } = await render(<SessionDetailScreen />, { wrapper: createWrapper() })
    expect(warningTitles()).toHaveLength(1)

    await unmount()
    expect(warningTitles()).toEqual([])
  })
})
