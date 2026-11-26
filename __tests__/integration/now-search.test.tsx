import React from 'react'
import { Keyboard } from 'react-native'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import ProjectsHub from '@/app/index'
import { useServersStore } from '@/stores/servers'
import { useSettingsStore } from '@/stores/settings'
import { useViewPrefsStore } from '@/stores/viewPrefs'
import { createWrapper } from '@/test-utils'
import '@/test-utils/i18n-setup'
import type { MultiConversation, MultiSession } from '@/types/api'

// Lets one test hold the debounce open; a real 300ms window closes early on a loaded machine.
let mockDebounceMs: number | null = null
jest.mock('use-debounce', () => {
  const actual = jest.requireActual<typeof import('use-debounce')>('use-debounce')
  return { useDebounce: <T,>(value: T, ms: number) => actual.useDebounce(value, mockDebounceMs ?? ms) }
})

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
  projectPath: '/tmp/other',
  messageCount: 3,
  lastActivity: '2024-03-14T10:00:00.000Z',
})

type SearchResult = { data: { conversations: MultiConversation[] } | undefined; isFetching: boolean }

const mockSearch = jest.fn<SearchResult, [string]>()
jest.mock('@/hooks/useConversations', () => ({
  ...jest.requireActual('@/hooks/useConversations'),
  useConversations: () => ({
    data: { pages: [{ conversations: [], hasMore: false, offset: 0, total: 0 }], pageParams: [0] },
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: jest.fn(),
    isLoading: false,
    isFetching: false,
  }),
  useConversationSearch: (q: string) => mockSearch(q),
}))

let mockSessions: MultiSession[] = []
jest.mock('@/hooks/useSession', () => ({
  useEagerSessions: () => ({
    sessions: mockSessions,
    isDone: true,
    loaded: 0,
    total: 0,
    inFlightCount: 0,
    refetch: jest.fn(),
    retryFailed: jest.fn(),
    isRetrying: false,
  }),
}))

const liveSession = {
  id: 'live-1',
  serverId: 'srv-1',
  conversationId: 'hit-live',
  status: 'waiting_input',
  projectName: 'streamer',
  projectPath: '/tmp/streamer',
  lastOutput: '',
  startedAt: '2026-11-26T04:00:00.000Z',
} as MultiSession

const results = (...conversations: MultiConversation[]) => (q: string): SearchResult => ({
  data: q ? { conversations } : undefined,
  isFetching: false,
})

beforeEach(() => {
  mockSessions = []
  useServersStore.setState({
    servers: { 'srv-1': { id: 'srv-1', url: 'http://one', apiKey: 'k', label: 'Mac', isConnected: true, serverInfo: null, connectionError: null } },
    activeServerIds: ['srv-1'],
    displayedServerIds: ['srv-1'],
    hasEverHadServer: true,
    isLoading: false,
  })
  useSettingsStore.setState({ boardOpen: false, sessionsLayout: 'now' })
  mockSearch.mockReset()
})

async function search(query: string) {
  const r = await render(<ProjectsHub />, { wrapper: createWrapper() })
  await fireEvent.press(r.getByTestId('header-search-btn'))
  await fireEvent.changeText(r.getByTestId('hub-search-input'), query)
  await waitFor(() => expect(mockSearch).toHaveBeenCalledWith(query))
  return r
}

describe('Now search', () => {
  afterEach(() => {
    mockDebounceMs = null
  })

  it('shows the searching animation instead of "No results" while the request is in flight', async () => {
    mockSearch.mockImplementation((q) => ({ data: undefined, isFetching: q !== '' }))
    const r = await search('wombat')
    expect(r.getByTestId('searching-animation')).toBeTruthy()
    expect(r.queryByText('No results')).toBeNull()
  })

  it('shows the animation during the debounce, before the request is sent', async () => {
    mockDebounceMs = 60_000
    mockSearch.mockImplementation(results())
    const r = await render(<ProjectsHub />, { wrapper: createWrapper() })
    await fireEvent.press(r.getByTestId('header-search-btn'))
    await fireEvent.changeText(r.getByTestId('hub-search-input'), 'wombat')
    expect(mockSearch).not.toHaveBeenCalledWith('wombat')
    expect(r.getByTestId('searching-animation')).toBeTruthy()
    expect(r.queryByText('No results')).toBeNull()
  })

  it('says "No results" once the server answered with nothing', async () => {
    mockSearch.mockImplementation(results())
    const r = await search('wombat')
    await waitFor(() => expect(r.getByText('No results')).toBeTruthy())
    expect(r.queryByTestId('searching-animation')).toBeNull()
  })

  it('shows an old match without opening its date group', async () => {
    mockSearch.mockImplementation(results(conv('old', 'Quarterly planning')))
    const r = await search('wombat')
    await waitFor(() => expect(r.getByTestId('conversation-row-old')).toBeTruthy())
  })

  it('keeps the live session when the server matched its conversation', async () => {
    mockSessions = [liveSession]
    mockSearch.mockImplementation(results(conv('hit-live', 'Batch integration')))
    const r = await search('batch')
    await waitFor(() => expect(r.getByTestId('now-list')).toHaveTextContent(/streamer/))
    expect(r.queryByText('No results')).toBeNull()
    expect(r.queryByTestId('conversation-row-hit-live')).toBeNull()
  })

  it('searches past the "needs me" preset', async () => {
    mockSessions = [liveSession]
    mockSearch.mockImplementation(results(conv('old', 'Quarterly planning')))
    const r = await render(<ProjectsHub />, { wrapper: createWrapper() })
    await fireEvent.press(r.getByTestId('preset-needs-me'))
    await fireEvent.press(r.getByTestId('header-search-btn'))
    await fireEvent.changeText(r.getByTestId('hub-search-input'), 'wombat')
    await waitFor(() => expect(r.getByTestId('conversation-row-old')).toBeTruthy())
    expect(r.queryByTestId('preset-needs-me')).toBeNull()
  })

  it('searches past the "active within" filter', async () => {
    mockSearch.mockImplementation(results(conv('old', 'Quarterly planning')))
    const r = await render(<ProjectsHub />, { wrapper: createWrapper() })
    await fireEvent.press(r.getByTestId('filter-sort-button'))
    await fireEvent.press(r.getByTestId('within-today'))
    await fireEvent.press(r.getByTestId('header-search-btn'))
    await fireEvent.changeText(r.getByTestId('hub-search-input'), 'wombat')
    await waitFor(() => expect(r.getByTestId('conversation-row-old')).toBeTruthy())
  })

  it('shows a match from a collapsed server group', async () => {
    const { servers } = useServersStore.getState()
    useServersStore.setState({
      servers: { ...servers, 'srv-2': { ...servers['srv-1'], id: 'srv-2', label: 'Linux' } },
      activeServerIds: ['srv-1', 'srv-2'],
      displayedServerIds: ['srv-1', 'srv-2'],
    })
    useViewPrefsStore.setState({ collapsedServers: ['srv-1'] })
    mockSearch.mockImplementation(results(conv('old', 'One'), { ...conv('other', 'Two'), serverId: 'srv-2' }))
    const r = await search('wombat')
    await waitFor(() => expect(r.getByTestId('conversation-row-old')).toBeTruthy())
    useViewPrefsStore.setState({ collapsedServers: [] })
  })

  it('puts the keyboard overlay over the home list only in search mode', async () => {
    const visible = jest.spyOn(Keyboard, 'isVisible').mockReturnValue(true)
    mockSearch.mockImplementation(results())
    const r = await render(<ProjectsHub />, { wrapper: createWrapper() })
    expect(r.queryByTestId('keyboard-dismiss-overlay')).toBeNull()
    await fireEvent.press(r.getByTestId('header-search-btn'))
    expect(r.getByTestId('keyboard-dismiss-overlay')).toBeTruthy()
    visible.mockRestore()
  })
})
