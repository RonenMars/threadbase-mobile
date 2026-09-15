import React from 'react'
import { render } from '@testing-library/react-native'
import ProjectsHub from '@/app/index'
import { useAlertStore } from '@/stores/alerts'
import { useServerFetchStatusStore } from '@/stores/serverFetchStatus'
import { useServersStore } from '@/stores/servers'
import { createWrapper } from '@/test-utils'
import { serverCause } from '@/types/alerts'

jest.mock('@/services/ws-client', () => ({
  wsManager: {
    status: () => 'disconnected',
    lastError: () => null,
    onAnyStatusChange: () => () => {},
  },
}))

jest.mock('@/hooks/useSessionName', () => ({
  useFetchSessionNames: () => {},
}))

jest.mock('@/hooks/useProjectSummaries', () => ({
  useProjectSummaries: () => ({
    summaries: [],
    unsupportedServerIds: [],
    isLoading: false,
    isFetching: false,
  }),
}))

jest.mock('@/hooks/useConversations', () => ({
  useConversations: () => ({
    data: undefined,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: jest.fn(),
    isLoading: false,
    isFetching: false,
  }),
  useConversationSearch: () => ({ data: undefined }),
}))

jest.mock('@/hooks/useSession', () => {
  const startedAt = '2026-09-14T10:00:00.000Z'
  const session = (id: string, serverId: string) => ({
    id,
    serverId,
    status: 'idle',
    ptyAttached: false,
    subStatus: null,
    projectPath: '/tmp/p',
    projectName: 'p',
    lastOutput: '',
    elapsedMs: 1000,
    promptCount: 1,
    startedAt,
    sessionName: `Session ${id}`,
  })
  return {
    useEagerSessions: () => ({
      sessions: [session('a1', 'srv-1'), session('b1', 'srv-2')],
      isDone: true,
      loaded: 2,
      total: 2,
      inFlightCount: 0,
      refetch: jest.fn(),
      retryFailed: jest.fn(),
      isRetrying: false,
    }),
  }
})

function seedTwoServers() {
  useServersStore.setState({
    servers: {
      'srv-1': { id: 'srv-1', url: 'http://one', apiKey: 'k', label: 'MacBook Pro', isConnected: true, serverInfo: null, connectionError: null },
      'srv-2': { id: 'srv-2', url: 'http://two', apiKey: 'k', label: 'studio-linux', isConnected: true, serverInfo: null, connectionError: null },
    },
    activeServerIds: ['srv-1', 'srv-2'],
    displayedServerIds: ['srv-1', 'srv-2'],
    hasEverHadServer: true,
    isLoading: false,
  })
}

describe('home inline-first failures', () => {
  beforeEach(() => {
    useAlertStore.getState().reset()
    useServerFetchStatusStore.getState().reset()
    seedTwoServers()
  })

  afterEach(() => {
    useAlertStore.getState().reset()
    useServerFetchStatusStore.getState().reset()
    useServersStore.setState({ servers: {}, activeServerIds: [], displayedServerIds: [], hasEverHadServer: false })
  })

  it('keeps the list and omits the old offline banner when some servers fail', async () => {
    useServerFetchStatusStore.getState().recordFailure('srv-1', new Error('offline'))
    const { getByTestId, queryByTestId } = await render(<ProjectsHub />, { wrapper: createWrapper() })
    expect(queryByTestId('server-offline-banner')).toBeNull()
    expect(queryByTestId('stale-scope-banner')).toBeNull()
    expect(getByTestId('server-failure-srv-1')).toBeTruthy()
    expect(getByTestId('now-list-scroll')).toBeTruthy()
  })

  it('shows the stale-scope banner, keeps the list, and hides the pill when every server is down', async () => {
    useServerFetchStatusStore.getState().recordFailure('srv-1', new Error('offline'))
    useServerFetchStatusStore.getState().recordFailure('srv-2', new Error('offline'))
    useAlertStore.getState().upsert({
      id: 'srv-1',
      viewport: 'global',
      cause: serverCause('srv-1'),
      level: 'error',
      title: 'MacBook Pro',
      message: 'down',
      timeout: null,
    })
    useAlertStore.getState().upsert({
      id: 'srv-2',
      viewport: 'global',
      cause: serverCause('srv-2'),
      level: 'error',
      title: 'studio-linux',
      message: 'down',
      timeout: null,
    })
    const { getByTestId, queryByTestId } = await render(<ProjectsHub />, { wrapper: createWrapper() })
    expect(getByTestId('stale-scope-banner')).toBeTruthy()
    expect(getByTestId('now-list-scroll')).toBeTruthy()
    expect(queryByTestId('server-failure-srv-1')).toBeNull()
    expect(queryByTestId('status-pill')).toBeNull()
  })
})
