/**
 * SessionScreen — the uncapped conversation tail backs only the review sheet,
 * so it must not be fetched until the sheet opens. Mounted eagerly, it was a
 * second ~0.5 MB copy of the conversation on every open and every refresh.
 */
import React, { type EffectCallback } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
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
const BASE_SESSION = {
  id: 'sess-live',
  ptyAttached: true,
  status: 'waiting_input',
  conversationId: 'sess-live',
  projectName: 'my-project',
  promptCount: 3,
  elapsedMs: 5000,
  failureReason: null,
}
const mockSession: { current: Record<string, unknown> } = { current: BASE_SESSION }
jest.mock('@/hooks/useSession', () => ({
  useSessionDetail: () => ({ data: mockSession.current, isLoading: false }),
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

interface ConversationOpts {
  enabled?: boolean
  maxBytes?: number
}
const mockUseConversation = jest.fn((_serverId: string, _id: string, _opts?: ConversationOpts) => ({
  data: undefined,
  isLoading: false,
}))
jest.mock('@/hooks/useConversations', () => ({
  ...jest.requireActual('@/hooks/useConversations'),
  useConversation: (serverId: string, id: string, opts?: ConversationOpts) =>
    mockUseConversation(serverId, id, opts),
}))

// eslint-disable-next-line import/first
import SessionDetailScreen from '@/app/session/[id]'

function uncappedEnabledCalls() {
  return mockUseConversation.mock.calls.filter(([, , opts]) => opts?.maxBytes == null && opts?.enabled === true)
}

describe('SessionScreen — review fetch', () => {
  beforeEach(() => {
    mockSession.current = BASE_SESSION
    mockUseConversation.mockClear()
  })

  it('does not fetch the uncapped tail until the review sheet opens', async () => {
    await render(<SessionDetailScreen />, { wrapper: createWrapper() })
    expect(uncappedEnabledCalls()).toHaveLength(0)

    await act(async () => {
      fireEvent.press(screen.getByTestId('session-overflow-menu'))
    })
    await act(async () => {
      fireEvent.press(screen.getByTestId('session-review-button'))
    })
    expect(uncappedEnabledCalls().length).toBeGreaterThan(0)
    expect(uncappedEnabledCalls()[0].slice(0, 2)).toEqual(['srv1', 'sess-live'])
  })
})
