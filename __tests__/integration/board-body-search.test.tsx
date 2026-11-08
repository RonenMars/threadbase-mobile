import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import ProjectsHub from '@/app/index'
import { useServersStore } from '@/stores/servers'
import { useSettingsStore } from '@/stores/settings'
import { createWrapper } from '@/test-utils'
import '@/test-utils/i18n-setup'
import type { MultiConversation } from '@/types/api'

jest.mock('@/services/ws-client', () => ({
  wsManager: { status: () => 'connected', lastError: () => null, onAnyStatusChange: () => () => {} },
}))

jest.mock('@/hooks/useSessionName', () => ({
  useFetchSessionNames: () => {},
  SessionNamesSyncer: () => null,
}))

jest.mock('@/hooks/useProjectSummaries', () => ({
  useProjectSummaries: () => ({ summaries: [], unsupportedServerIds: [], isLoading: false, isFetching: false }),
}))

jest.mock('@/hooks/useAllSubagents', () => ({
  useAllSubagents: () => ({ items: [], isError: false }),
}))

const conv = (id: string, title: string): MultiConversation => ({
  id,
  serverId: 'srv-1',
  title,
  preview: 'nothing relevant',
  projectPath: '/tmp/p',
  messageCount: 3,
  lastActivity: '2026-09-14T10:00:00.000Z',
})

const mockPagedData = { pages: [{ conversations: [conv('paged', 'Paged history chat')], hasMore: false, offset: 0, total: 1 }], pageParams: [0] }
const bodyOnly = conv('body', 'Quarterly planning')

const mockSearch = jest.fn<{ data: { conversations: MultiConversation[] } | undefined }, [string]>()
jest.mock('@/hooks/useConversations', () => ({
  ...jest.requireActual('@/hooks/useConversations'),
  useConversations: () => ({
    data: mockPagedData,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: jest.fn(),
    isLoading: false,
    isFetching: false,
  }),
  useConversationSearch: (q: string) => mockSearch(q),
}))

jest.mock('@/hooks/useSession', () => ({
  useEagerSessions: () => ({
    sessions: [],
    isDone: true,
    loaded: 0,
    total: 0,
    inFlightCount: 0,
    refetch: jest.fn(),
    retryFailed: jest.fn(),
    isRetrying: false,
  }),
}))

beforeEach(() => {
  useServersStore.setState({
    servers: { 'srv-1': { id: 'srv-1', url: 'http://one', apiKey: 'k', label: 'Mac', isConnected: true, serverInfo: null, connectionError: null } },
    activeServerIds: ['srv-1'],
    displayedServerIds: ['srv-1'],
    hasEverHadServer: true,
    isLoading: false,
  })
  useSettingsStore.setState({ boardOpen: true, boardColumn: 'earlier' })
  mockSearch.mockReset()
  mockSearch.mockImplementation((q) => ({ data: q ? { conversations: [bodyOnly] } : undefined }))
})

describe('home board search', () => {
  it('finds a conversation by its message body once the debounced query is set, and restores the paged history when cleared', async () => {
    const r = await render(<ProjectsHub />, { wrapper: createWrapper() })
    expect(r.getByTestId('board-open-paged')).toBeTruthy()

    await fireEvent.press(r.getByTestId('header-search-btn'))
    await fireEvent.changeText(r.getByTestId('hub-search-input'), 'wombat')

    // Neither title nor preview of the body-only conversation contains the query.
    await waitFor(() => expect(r.getByTestId('board-open-body')).toBeTruthy())
    expect(r.queryByTestId('board-open-paged')).toBeNull()
    expect(r.getByTestId('board-column-earlier')).toHaveTextContent('Earlier1')

    await fireEvent.changeText(r.getByTestId('hub-search-input'), '')
    await waitFor(() => expect(r.getByTestId('board-open-paged')).toBeTruthy())
    expect(r.queryByTestId('board-open-body')).toBeNull()
  })

  it('does not search the server before the query settles', async () => {
    const r = await render(<ProjectsHub />, { wrapper: createWrapper() })
    await fireEvent.press(r.getByTestId('header-search-btn'))
    await fireEvent.changeText(r.getByTestId('hub-search-input'), 'wombat')
    expect(r.queryByTestId('board-open-body')).toBeNull()
    expect(mockSearch).not.toHaveBeenCalledWith('wombat')
    await waitFor(() => expect(mockSearch).toHaveBeenCalledWith('wombat'))
  })
})
