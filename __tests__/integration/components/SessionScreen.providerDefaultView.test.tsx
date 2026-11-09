/**
 * SessionScreen — default view mode per provider.
 *
 * Cursor opens in Terminal; every other provider follows the global setting (chat).
 * Either can be switched with the header chip.
 */
import React, { type EffectCallback } from 'react'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { createWrapper } from '@/test-utils'

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
let mockProvider = 'claude'
const mockSetSessionView = jest.fn()
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
      provider: mockProvider,
    },
    isLoading: false,
  }),
}))
jest.mock('@/hooks/useSessionActions', () => ({
  useSessionActions: () => ({ sendInput: { mutate: jest.fn() }, adoptSession: { mutate: jest.fn() }, sendKeys: { mutate: jest.fn(), isPending: false }, stopSession: { mutate: jest.fn(), isPending: false }, setModel: { mutate: jest.fn(), error: null, isPending: false }, setEffort: { mutate: jest.fn(), error: null, isPending: false } }),
}))
jest.mock('@/services/ws-client', () => ({
  wsManager: {
    getClient: () => null,
    forceReconnect: jest.fn(),
    status: () => 'connected',
    onAnyStatusChange: () => () => {},
    reconnectAttempt: () => 0,
    onAnyReconnectAttempt: () => () => {},
  },
}))
jest.mock('@/stores/servers', () => ({
  useServersStore: (sel: (s: { activeServerIds: string[]; servers: Record<string, unknown> }) => unknown) =>
    sel({ activeServerIds: ['srv1'], servers: { srv1: {} } }),
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
  useSettingsStore: () => ({ sessionView: 'chat', setSessionView: mockSetSessionView }),
}))
jest.mock('expo-router', () => {
  const React = require('react')
  return {
    useLocalSearchParams: () => ({ id: 'sess-live', server: 'srv1' }),
    useRouter: () => ({ replace: jest.fn(), back: jest.fn() }),
    useNavigation: () => ({ setOptions: jest.fn(), addListener: jest.fn(() => jest.fn()) }),
    useFocusEffect: (cb: EffectCallback) => {
      React.useEffect(() => cb(), [cb])
    },
  }
})
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}))

// eslint-disable-next-line import/first
import SessionDetailScreen from '@/app/session/[id]'

describe('SessionScreen — default view mode per provider', () => {
  beforeEach(() => mockSetSessionView.mockClear())

  const chipLabel = () => screen.getByTestId('session-view-mode-chip').props.accessibilityLabel

  it('opens a non-Cursor session in Chat', async () => {
    mockProvider = 'claude'
    await render(<SessionDetailScreen />, { wrapper: createWrapper() })
    expect(chipLabel()).toBe('Chat')
  })

  it('opens a Cursor session in Terminal', async () => {
    mockProvider = 'cursor'
    await render(<SessionDetailScreen />, { wrapper: createWrapper() })
    expect(chipLabel()).toBe('Terminal')
  })

  it('lets a Cursor session switch to Chat without touching the global setting', async () => {
    mockProvider = 'cursor'
    await render(<SessionDetailScreen />, { wrapper: createWrapper() })
    await fireEvent.press(screen.getByTestId('session-view-mode-chip'))
    expect(chipLabel()).toBe('Chat')
    expect(mockSetSessionView).not.toHaveBeenCalled()
  })

  it('lets a non-Cursor session switch to Terminal via the global setting', async () => {
    mockProvider = 'claude'
    await render(<SessionDetailScreen />, { wrapper: createWrapper() })
    await fireEvent.press(screen.getByTestId('session-view-mode-chip'))
    expect(mockSetSessionView).toHaveBeenCalledWith('terminal')
  })
})
