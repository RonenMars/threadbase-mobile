import React from 'react'
import { fireEvent, waitFor } from '@testing-library/react-native'
import { ProjectHubList } from '@/components/sessions/hub/ProjectHubList'
import type { MultiProjectSummary } from '@/hooks/useProjectSummaries'
import { renderWithI18n } from '@/test-utils/render'
import { useServersStore } from '@/stores/servers'
import { useServerFetchStatusStore } from '@/stores/serverFetchStatus'
import i18n from '@/test-utils/i18n-setup'
import type { MultiSession } from '@/types/api'

jest.mock('@/hooks/useConversations', () => ({
  useConversationSearch: () => ({ data: undefined }),
}))

jest.mock('@/hooks/useProjectConversations', () => ({
  useProjectConversations: () => ({ conversations: [], isLoading: false }),
}))

const NOW = Date.now()
const DAY = 86_400_000

function summary(name: string, ageMs: number): MultiProjectSummary {
  return {
    serverId: 'srv-1',
    path: `/home/user/${name}`,
    name,
    conversationCount: 4,
    lastActivity: new Date(NOW - ageMs).toISOString(),
  }
}

const liveSession: MultiSession = {
  id: 'live',
  serverId: 'srv-1',
  status: 'running',
  ptyAttached: true,
  lifecycle: 'attached',
  subStatus: null,
  projectPath: '/home/user/live-app',
  projectName: 'live-app',
  lastOutput: '',
  elapsedMs: 1000,
  promptCount: 1,
  startedAt: new Date(NOW - 60_000).toISOString(),
}

function renderHub(sessions: MultiSession[], summaries: MultiProjectSummary[]) {
  return renderWithI18n(
    <ProjectHubList
      sessions={sessions}
      summaries={summaries}
      sortBy="lastActivity"
      sortOrder="desc"
      refreshing={false}
      onRefresh={() => {}}
      searchOpen={false}
      searchQuery=""
    />,
  )
}

beforeEach(async () => {
  await i18n.changeLanguage('en')
})

describe('ProjectHubList tiers', () => {
  it('splits projects into ACTIVE, RECENT and a folded QUIET tail, and unfolds on Show', async () => {
    const { getByText, getByTestId, queryByTestId, getAllByTestId } = await renderHub(
      [liveSession],
      [summary('fresh', DAY), summary('old-one', 40 * DAY), summary('old-two', 90 * DAY)],
    )
    expect(getByText('ACTIVE · 1')).toBeTruthy()
    expect(getByText('RECENT')).toBeTruthy()
    expect(getByText('QUIET · 2')).toBeTruthy()
    expect(getByTestId('hub-quiet-chips')).toBeTruthy()
    // The chip carries the card's id, so a flow reaching for the project still finds it.
    expect(getAllByTestId('hub-project-old-one')).toHaveLength(1)

    fireEvent.press(getByTestId('hub-quiet-toggle-all'))
    await waitFor(() => expect(queryByTestId('hub-quiet-chips')).toBeNull())
    expect(getByText('Hide')).toBeTruthy()
    expect(getByTestId('hub-project-old-two')).toBeTruthy()
  })

  it('shows the tail as cards when there is nothing above it to fold under', async () => {
    const { queryByTestId, getByTestId, queryByText } = await renderHub([], [summary('old-one', 40 * DAY)])
    expect(queryByTestId('hub-quiet-chips')).toBeNull()
    expect(getByTestId('hub-project-old-one')).toBeTruthy()
    expect(queryByText('Show')).toBeNull()
  })

  it('narrows the cards with the path filter', async () => {
    const { getByTestId, queryByText, getByText } = await renderHub(
      [liveSession],
      [summary('fresh', DAY), summary('old-one', 40 * DAY)],
    )
    fireEvent.changeText(getByTestId('hub-project-filter'), 'old')
    await waitFor(() => expect(queryByText('ACTIVE · 1')).toBeNull())
    expect(queryByText('RECENT')).toBeNull()
    expect(getByText('QUIET · 1')).toBeTruthy()
    expect(getByTestId('hub-project-old-one')).toBeTruthy()
  })
})

describe('ProjectHubList server failure', () => {
  afterEach(() => {
    useServerFetchStatusStore.getState().reset()
    useServersStore.setState({ activeServerIds: [], displayedServerIds: [], servers: {} })
  })

  it('shows a section failure panel for one down host', async () => {
    useServersStore.setState({
      activeServerIds: ['srv-1', 'srv-2'],
      displayedServerIds: ['srv-1', 'srv-2'],
      servers: {
        'srv-1': { id: 'srv-1', url: 'http://one', apiKey: 'k', label: 'MacBook Pro', isConnected: true, serverInfo: null, connectionError: null },
        'srv-2': { id: 'srv-2', url: 'http://two', apiKey: 'k', label: 'studio-linux', isConnected: true, serverInfo: null, connectionError: null },
      },
    })
    useServerFetchStatusStore.getState().recordFailure('srv-2', new Error('offline'))
    const { getByTestId, queryByTestId } = await renderHub(
      [liveSession],
      [
        summary('fresh', DAY),
        { ...summary('other', DAY), serverId: 'srv-2', path: '/home/user/other', name: 'other' },
      ],
    )
    expect(getByTestId('server-failure-srv-2')).toBeTruthy()
    expect(getByTestId('server-header-retry-srv-2')).toBeTruthy()
    expect(queryByTestId('server-failure-srv-1')).toBeNull()
  })

  it('does not paint per-server failure panels when every host is down', async () => {
    useServersStore.setState({
      activeServerIds: ['srv-1', 'srv-2'],
      displayedServerIds: ['srv-1', 'srv-2'],
      servers: {
        'srv-1': { id: 'srv-1', url: 'http://one', apiKey: 'k', label: 'MacBook Pro', isConnected: true, serverInfo: null, connectionError: null },
        'srv-2': { id: 'srv-2', url: 'http://two', apiKey: 'k', label: 'studio-linux', isConnected: true, serverInfo: null, connectionError: null },
      },
    })
    useServerFetchStatusStore.getState().recordFailure('srv-1', new Error('offline'))
    useServerFetchStatusStore.getState().recordFailure('srv-2', new Error('offline'))
    const { getByTestId, queryByTestId } = await renderHub(
      [liveSession],
      [
        summary('fresh', DAY),
        { ...summary('other', DAY), serverId: 'srv-2', path: '/home/user/other', name: 'other' },
      ],
    )
    expect(queryByTestId('server-failure-srv-1')).toBeNull()
    expect(queryByTestId('server-failure-srv-2')).toBeNull()
    expect(getByTestId('hub-project-fresh')).toBeTruthy()
  })
})
