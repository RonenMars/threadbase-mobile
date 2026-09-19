/**
 * SessionScreen — info modal rows: provider always shown (Unknown when absent,
 * never a Claude default) and every id labelled by what it is.
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

// eslint-disable-next-line import/first
import SessionDetailScreen from '@/app/session/[id]'

async function openInfo() {
  await render(<SessionDetailScreen />, { wrapper: createWrapper() })
  await act(async () => {
    fireEvent.press(screen.getByTestId('session-overflow-menu'))
  })
  await act(async () => {
    fireEvent.press(screen.getByTestId('session-info-button'))
  })
}

describe('SessionScreen — info modal', () => {
  it('shows Unknown when the server sends no provider', async () => {
    mockSession.current = BASE_SESSION
    await openInfo()
    expect(screen.getByText('Provider')).toBeTruthy()
    expect(screen.getByText('Unknown')).toBeTruthy()
    expect(screen.queryByText('claude-code')).toBeNull()
  })

  it('separates the Codex rollout id from the Threadbase session id', async () => {
    mockSession.current = {
      ...BASE_SESSION,
      provider: 'codex-cli',
      boundConversationId: '019a0000-aaaa-bbbb-cccc-dddddddddddd',
      resumedFromConversationId: 'prev-conv',
    }
    await openInfo()
    expect(screen.getByText('Codex')).toBeTruthy()
    expect(screen.getByText('Threadbase Session ID / Conversation ID')).toBeTruthy()
    expect(screen.getByText('Provider ID')).toBeTruthy()
    expect(screen.getByText('019a0000-aaaa-bbbb-cccc-dddddddddddd')).toBeTruthy()
    expect(screen.getByText('Resumed From')).toBeTruthy()
    expect(screen.queryByText('Forked From')).toBeNull()
  })
})
