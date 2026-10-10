import { Platform } from 'react-native'
import { act, fireEvent, waitFor, within } from '@testing-library/react-native'
import SessionBoard from '@/app/board'
import { renderWithI18n } from '@/test-utils/render'
import { useServersStore } from '@/stores/servers'
import type { MultiConversation, MultiSession } from '@/types/api'

const mockSessions: { current: MultiSession[] } = { current: [] }

jest.mock('expo-router', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native')
  return {
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false }),
    useLocalSearchParams: () => ({}),
    Redirect: ({ href }: { href: string }) => <Text testID="redirect">{href}</Text>,
  }
})

jest.mock('@/hooks/useSession', () => ({
  useEagerSessions: () => ({ sessions: mockSessions.current }),
}))

const mockConversations: { current: MultiConversation[] } = { current: [] }
const mockFetchNextPage = jest.fn()
const mockHasNextPage = { current: false }

jest.mock('@/hooks/useConversations', () => ({
  dedupeByServerAndId: (rows: MultiConversation[]) => rows,
  useConversations: () => ({
    data: { pages: [{ conversations: mockConversations.current }] },
    hasNextPage: mockHasNextPage.current,
    isFetchingNextPage: false,
    fetchNextPage: mockFetchNextPage,
  }),
}))

jest.mock('@/hooks/useSessionName', () => ({
  SessionNamesSyncer: () => null,
}))

jest.mock('@/hooks/useSessionActions', () => ({
  useSessionActions: () => ({
    stopSession: { mutate: jest.fn(), isPending: false },
    stopWhenIdle: { mutateAsync: jest.fn(), isPending: false },
    sendInput: { mutate: jest.fn(), isPending: false },
  }),
}))

const NOW = Date.now()

const session = (overrides: Partial<MultiSession>): MultiSession => ({
  id: 'sid',
  serverId: 'server-1',
  status: 'idle',
  ptyAttached: false,
  subStatus: null,
  projectPath: '/home/user/tb-mobile',
  projectName: 'tb-mobile',
  branch: 'main',
  lastOutput: '',
  elapsedMs: 1000,
  promptCount: 1,
  startedAt: new Date(NOW - 60_000).toISOString(),
  ...overrides,
})

const waiting = session({ id: 'w', status: 'waiting_input', ptyAttached: true, lifecycle: 'attached', sessionName: 'Review the migration' })
const running = session({ id: 'r', status: 'running', ptyAttached: true, lifecycle: 'attached', sessionName: 'Reconcile the ledger' })
const external = session({ id: 'x', status: 'running', ownership: 'external', processLiveness: 'alive', sessionName: 'Started elsewhere' })
const idle = session({ id: 'i', sessionName: 'Finished earlier' })
const stale = session({ id: 'old', sessionName: 'Last week', startedAt: new Date(NOW - 8 * 86_400_000).toISOString() })

describe('SessionBoard', () => {
  let restoreOS: jest.ReplaceProperty<typeof Platform.OS>

  beforeEach(() => {
    restoreOS = jest.replaceProperty(Platform, 'OS', 'web')
    useServersStore.setState({
      activeServerIds: ['server-1'],
      displayedServerIds: ['server-1'],
      servers: {
        'server-1': { id: 'server-1', url: 'http://one', apiKey: 'k', label: 'MacBook Pro', isConnected: true, serverInfo: null, connectionError: null },
      },
    })
    mockSessions.current = [waiting, running, external, idle, stale]
    mockConversations.current = []
    mockHasNextPage.current = false
    mockFetchNextPage.mockClear()
  })

  afterEach(async () => {
    restoreOS.restore()
    await act(async () => useServersStore.setState({ activeServerIds: [], displayedServerIds: [], servers: {} }))
  })

  it('puts each session in the column its state derives', async () => {
    const { getByTestId } = await renderWithI18n(<SessionBoard />)
    expect(within(getByTestId('board-column-needsYou')).getByText('Review the migration')).toBeTruthy()
    expect(within(getByTestId('board-column-working')).getByText('Reconcile the ledger')).toBeTruthy()
    expect(within(getByTestId('board-column-observed')).getByText('Started elsewhere')).toBeTruthy()
    expect(within(getByTestId('board-column-earlier')).getByText('Finished earlier')).toBeTruthy()
  })

  it('bounds Earlier to today until the window is widened', async () => {
    const { getByTestId, queryByText } = await renderWithI18n(<SessionBoard />)
    expect(getByTestId('board-column-earlier-count').props.children).toBe('1/2')
    expect(queryByText('Last week')).toBeNull()

    // The control under the cards widens the window a step at a time; the card is 8 days old.
    await fireEvent.press(getByTestId('board-load-older'))
    await waitFor(() => expect(getByTestId('board-within-7d').props.accessibilityState.selected).toBe(true))
    expect(queryByText('Last week')).toBeNull()
    await fireEvent.press(getByTestId('board-load-older'))
    await waitFor(() => expect(getByTestId('board-column-earlier-count').props.children).toBe('2'))
    expect(queryByText('Last week')).toBeTruthy()
  })

  it('narrows every column by search and shows visible/total', async () => {
    const { getByTestId, queryByText } = await renderWithI18n(<SessionBoard />)
    await fireEvent.changeText(getByTestId('board-search'), 'ledger')
    await waitFor(() => expect(getByTestId('board-column-needsYou-count').props.children).toBe('0/1'))
    expect(getByTestId('board-column-working-count').props.children).toBe('1')
    expect(queryByText('Review the migration')).toBeNull()
  })

  it('leaves out sessions from servers the hub is not displaying', async () => {
    useServersStore.setState({ displayedServerIds: [] })
    const { getByTestId } = await renderWithI18n(<SessionBoard />)
    expect(getByTestId('board-column-working-count').props.children).toBe('0')
  })

  it('lists history conversations in Earlier and pages until the window is covered', async () => {
    mockConversations.current = [
      { id: 'c1', serverId: 'server-1', title: 'Past chat', projectPath: '/home/user/tb-mobile', messageCount: 2, lastActivity: new Date(NOW - 120_000).toISOString() },
    ]
    mockHasNextPage.current = true
    const { getByTestId } = await renderWithI18n(<SessionBoard />)
    expect(within(getByTestId('board-column-earlier')).getByTestId('conversation-row-c1')).toBeTruthy()
    // Every loaded conversation is inside "Today", so an older page may still hold more.
    expect(mockFetchNextPage).toHaveBeenCalled()
  })

  it('redirects to the hub on native', async () => {
    restoreOS.restore()
    const { getByTestId, queryByTestId } = await renderWithI18n(<SessionBoard />)
    expect(getByTestId('redirect').props.children).toBe('/')
    expect(queryByTestId('board-screen')).toBeNull()
  })
})
