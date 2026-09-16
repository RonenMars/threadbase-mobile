import React from 'react'
import { StyleSheet, Text } from 'react-native'
import { NowList } from '@/components/sessions/now/NowList'
import type { MergedItem } from '@/components/sessions/now/mergedItems'
import { formatListTime } from '@/components/sessions/shared/formatListTime'
import { fireEvent } from '@testing-library/react-native'
import { renderWithI18n } from '@/test-utils/render'
import { useQuietTailStore } from '@/stores/quietTail'
import { useServersStore } from '@/stores/servers'
import { useServerFetchStatusStore } from '@/stores/serverFetchStatus'
import i18n from '@/test-utils/i18n-setup'
import type { MultiConversation, MultiSession } from '@/types/api'

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}))

jest.mock('@/hooks/useSessionActions', () => ({
  useSessionActions: () => ({
    cancelSession: { mutate: jest.fn(), isPending: false },
    sendInput: { mutate: jest.fn(), isPending: false },
    addToQueue: { mutate: jest.fn(), isPending: false },
    removeFromQueue: { mutate: jest.fn(), isPending: false },
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

const conversation = (overrides: Partial<MultiConversation>): MultiConversation => ({
  id: 'cid',
  serverId: 'server-1',
  title: 'tb-mobile',
  projectPath: '/home/user/tb-mobile',
  messageCount: 5,
  lastActivity: new Date(NOW - 120_000).toISOString(),
  ...overrides,
})

const asItem = (s: MultiSession, ms = NOW - 60_000): MergedItem => ({ kind: 'session', ms, item: s })
const asConv = (c: MultiConversation, ms = NOW - 120_000): MergedItem => ({ kind: 'conversation', ms, item: c })

function renderList(
  items: MergedItem[],
  order: 'state' | 'lastActivity' | 'projectName' = 'state',
  extra: Partial<React.ComponentProps<typeof NowList>> = {},
) {
  return renderWithI18n(
    <NowList
      items={items}
      order={order}
      refreshing={false}
      onRefresh={() => {}}
      searchQuery=""
      conversationsFromServer={false}
      {...extra}
    />,
  )
}

beforeEach(async () => {
  await i18n.changeLanguage('en')
})

describe('NowList', () => {
  it('orders by state: needs you, then working, then earlier — and a held session is never live', async () => {
    const waiting = session({ id: 'w', status: 'waiting_input', ptyAttached: true, lifecycle: 'attached', sessionName: 'Why sessions open in terminal view' })
    const running = session({ id: 'r', status: 'running', ptyAttached: true, lifecycle: 'attached', sessionName: 'Scan all worktrees for stale ones' })
    const held = session({ id: 'h', status: 'waiting_input', ptyAttached: false, lifecycle: 'resumable', sessionName: 'Report slow streamer requests' })
    const { getByText, getByTestId, queryByText } = await renderList([
      asItem(held, NOW - 10_000),
      asItem(running, NOW - 20_000),
      asItem(waiting, NOW - 30_000),
    ])

    expect(getByText('NEEDS YOU · 1')).toBeTruthy()
    expect(getByText('WORKING · 1')).toBeTruthy()
    expect(getByText('EARLIER TODAY')).toBeTruthy()
    expect(getByTestId('session-row-w')).toBeTruthy()
    expect(getByTestId('session-row-r')).toBeTruthy()
    expect(getByTestId('first-session-card')).toBeTruthy()
    expect(getByText('Report slow streamer requests')).toBeTruthy()
    expect(queryByText('NEEDS YOU · 2')).toBeNull()
  })

  it('keeps up to five quiet rows inline, in time order, as one-line rows', async () => {
    const quiet = ['hi', 'hey', 'Ahoy', 'yo', 'git pull'].map((name, i) =>
      asConv(conversation({ id: `n${i}`, sessionName: name, title: name, branch: 'main' }), NOW - 1000 * (i + 1)),
    )
    const real = asConv(conversation({ id: 'real', sessionName: 'Fix the resume collision copy' }), NOW - 500)
    const { getByText, getAllByText, queryByTestId, getByTestId } = await renderList([real, ...quiet])

    expect(queryByTestId('quiet-tail')).toBeNull()
    expect(getByTestId('conversation-row-real')).toBeTruthy()
    for (let i = 0; i < 5; i += 1) expect(getByTestId(`conversation-row-n${i}`)).toBeTruthy()
    // A greeting falls to the identity; a command keeps its own words with the identity beside it.
    expect(getAllByText('tb-mobile · main')).toHaveLength(4)
    // The identity is a nested Text inside the label, so the row's text reads as one string.
    expect(getByText(/^git pull/)).toBeTruthy()
  })

  it('gathers six or more quiet rows into one tail at the end of their group', async () => {
    const quiet = ['hi', 'hey', 'Ahoy', 'yo', 'sup', 'hello'].map((name, i) =>
      asConv(conversation({ id: `n${i}`, sessionName: name, title: name }), NOW - 1000 * (i + 1)),
    )
    const real = asConv(conversation({ id: 'real', sessionName: 'Fix the resume collision copy' }), NOW - 3500)
    const { getByText, getByTestId, queryByTestId } = await renderList([...quiet, real])

    expect(getByText('6 quiet sessions · nothing was asked')).toBeTruthy()
    expect(getByTestId('conversation-row-real')).toBeTruthy()
    expect(queryByTestId('conversation-row-n0')).toBeNull()
    const data = getByTestId('now-list-scroll').props.data as { kind: string }[]
    expect(data[data.length - 1].kind).toBe('quietTail')

    fireEvent.press(getByTestId('quiet-tail'))
    expect(useQuietTailStore.getState().entries.map((e) => e.item.item.id)).toEqual(['n0', 'n1', 'n2', 'n3', 'n4', 'n5'])
  })

  it('keeps Needs you above every server group when two servers are active', async () => {
    useServersStore.setState({
      activeServerIds: ['server-1', 'server-2'],
      servers: {
        'server-1': { id: 'server-1', url: 'http://one', apiKey: 'k', label: 'MacBook Pro', isConnected: true, serverInfo: null, connectionError: null },
        'server-2': { id: 'server-2', url: 'http://two', apiKey: 'k', label: 'studio-linux', isConnected: true, serverInfo: null, connectionError: null },
      },
    })
    try {
      const waiting = session({ id: 'w', serverId: 'server-2', status: 'waiting_input', ptyAttached: true, lifecycle: 'attached', sessionName: 'Why sessions open in terminal view' })
      const older1 = asConv(conversation({ id: 'c1', serverId: 'server-1', sessionName: 'Report slow streamer requests' }), NOW - 5000)
      const older2 = asConv(conversation({ id: 'c2', serverId: 'server-2', sessionName: 'Nightly eval sweep, 200 prompts' }), NOW - 1000)
      const { getByTestId } = await renderList([older2, older1, asItem(waiting, NOW - 9000)])
      const keys = (getByTestId('now-list-scroll').props.data as { key: string }[]).map((f) => f.key)
      expect(keys.indexOf('eyebrow-needsYou')).toBeLessThan(keys.indexOf('server-server-1'))
      expect(keys.indexOf('server-server-1')).toBeLessThan(keys.indexOf('server-server-2'))
      expect(keys.indexOf('session:server-2::w')).toBeLessThan(keys.indexOf('server-server-1'))
    } finally {
      useServersStore.setState({ activeServerIds: [], servers: {} })
    }
  })

  it('drops the sections in Recent order but keeps live rows as cards', async () => {
    const waiting = session({ id: 'w', status: 'waiting_input', ptyAttached: true, lifecycle: 'attached', sessionName: 'Why sessions open in terminal view' })
    const { queryByText, getByTestId } = await renderList([asItem(waiting)], 'lastActivity')
    expect(queryByText('NEEDS YOU · 1')).toBeNull()
    expect(getByTestId('first-session-card')).toBeTruthy()
    expect(queryByText('Needs you')).toBeTruthy()
  })

  it('stamps a history row with the clock it was bucketed by', async () => {
    const eightDays = 8 * 86_400_000
    const startedAt = new Date(NOW - eightDays).toISOString()
    // No completedAt: activity is startedAt + elapsedMs, which reaches today.
    const old = session({ id: 'old', sessionName: 'Migrate the settings store to zustand', startedAt, elapsedMs: eightDays - 120_000 })
    const ms = NOW - 120_000
    const { getByText, queryByText } = await renderList([asItem(old, ms)])

    expect(getByText('EARLIER TODAY')).toBeTruthy()
    expect(queryByText('EARLIER')).toBeNull()
    expect(getByText(formatListTime(ms))).toBeTruthy()
    expect(queryByText(formatListTime(startedAt))).toBeNull()
  })

  it('scrolls the header with the rows and insets them by the chrome height', async () => {
    const real = asConv(conversation({ id: 'real', sessionName: 'Fix the resume collision copy' }))
    const { getByText, getByTestId } = await renderList([real], 'state', {
      topInset: 120,
      ListHeaderComponent: <Text>QUICK ACCESS</Text>,
    })
    expect(getByText('QUICK ACCESS')).toBeTruthy()
    const list = getByTestId('now-list-scroll')
    expect(StyleSheet.flatten(list.props.contentContainerStyle).paddingTop).toBe(120)
    expect(list.props.scrollIndicatorInsets).toEqual({ top: 120 })
  })

  it('keeps two rejected titles as plain quiet rows', async () => {
    const items = ['hi', 'hey'].map((name, i) => asConv(conversation({ id: `n${i}`, sessionName: name, title: name })))
    const { queryByTestId, getByTestId } = await renderList(items)
    expect(queryByTestId('quiet-tail')).toBeNull()
    expect(getByTestId('conversation-row-n0')).toBeTruthy()
  })

  it('renders a quiet conversation when projectPath is null', async () => {
    const ghost = conversation({ id: 'ghost', sessionName: 'hi', title: 'hi', branch: 'main' })
    Object.assign(ghost, { projectPath: null })
    const { getByTestId } = await renderList([asConv(ghost)])
    expect(getByTestId('conversation-row-ghost')).toBeTruthy()
  })

  it('sorts by project when a conversation has no projectPath', async () => {
    const ghost = conversation({ id: 'ghost', sessionName: 'Fix the resume collision copy' })
    Object.assign(ghost, { projectPath: null })
    const named = conversation({ id: 'named', sessionName: 'Scan all worktrees for stale ones' })
    const { getByTestId } = await renderList([asConv(ghost), asConv(named)], 'projectName')
    expect(getByTestId('conversation-row-ghost')).toBeTruthy()
    expect(getByTestId('conversation-row-named')).toBeTruthy()
  })

  it('renders a first-class cannot-resume row for a gone worktree', async () => {
    const gone = asConv(conversation({
      id: 'gone',
      sessionName: 'int-2026-09-12 · tb-streamer worktree',
      title: 'int-2026-09-12 · tb-streamer worktree',
      resumable: false,
      unavailableReason: 'worktree_removed',
    }))
    const { getByText, queryByTestId } = await renderList([gone])
    expect(getByText('Int-2026-09-12 · tb-streamer worktree')).toBeTruthy()
    expect(getByText("Worktree gone — can't resume")).toBeTruthy()
    expect(queryByTestId('quiet-tail')).toBeNull()
  })

  it('qualifies Needs you with how long the wait has lasted', async () => {
    const waiting = session({
      id: 'w',
      status: 'waiting_input',
      ptyAttached: true,
      lifecycle: 'attached',
      sessionName: 'Why sessions open in terminal view',
      statusUpdatedAt: new Date(NOW - 2 * 60_000).toISOString(),
    })
    const { getByText, queryByText } = await renderList([asItem(waiting)])
    expect(getByText('Needs you · waiting 2m')).toBeTruthy()
    expect(queryByText('waiting 22m')).toBeNull()
  })

  it('falls back to the JSONL tail when statusUpdatedAt is missing', async () => {
    const waiting = session({
      id: 'w',
      status: 'waiting_input',
      ptyAttached: true,
      lifecycle: 'attached',
      sessionName: 'Why sessions open in terminal view',
      activity: { state: 'quiet', lastEventAt: new Date(NOW - 45_000).toISOString(), source: 'jsonl' },
    })
    const { getByText } = await renderList([asItem(waiting)])
    expect(getByText('Needs you · waiting 45s')).toBeTruthy()
  })

  it('keeps live cards and shows history skeletons while a server is warming', async () => {
    const waiting = session({ id: 'w', status: 'waiting_input', ptyAttached: true, lifecycle: 'attached', sessionName: 'Why sessions open in terminal view' })
    const history = asConv(conversation({ id: 'old', sessionName: 'Fix the resume collision copy' }))
    const { getByTestId, getAllByTestId, queryByTestId } = await renderList(
      [asItem(waiting), history],
      'state',
      { warmingServerIds: ['server-1'] },
    )
    expect(getByTestId('session-row-w')).toBeTruthy()
    expect(queryByTestId('conversation-row-old')).toBeNull()
    expect(getAllByTestId('history-skeleton', { includeHiddenElements: true })).toHaveLength(2)
  })

  it('offers New session on an empty list', async () => {
    const onNewSession = jest.fn()
    const { getByTestId } = await renderList([], 'state', { onNewSession })
    expect(getByTestId('empty-state-action')).toBeTruthy()
  })

  it('puts a failure panel on a down server and keeps the other host healthy', async () => {
    useServersStore.setState({
      activeServerIds: ['server-1', 'server-2'],
      servers: {
        'server-1': { id: 'server-1', url: 'http://one', apiKey: 'k', label: 'MacBook Pro', isConnected: true, serverInfo: null, connectionError: null },
        'server-2': { id: 'server-2', url: 'http://two', apiKey: 'k', label: 'studio-linux', isConnected: true, serverInfo: null, connectionError: null },
      },
    })
    useServerFetchStatusStore.getState().recordFailure('server-1', new Error('offline'))
    try {
      const older1 = asConv(conversation({ id: 'c1', serverId: 'server-1', sessionName: 'Report slow streamer requests' }), NOW - 5000)
      const older2 = asConv(conversation({ id: 'c2', serverId: 'server-2', sessionName: 'Nightly eval sweep, 200 prompts' }), NOW - 1000)
      const { getByTestId, queryByTestId } = await renderList([older1, older2])
      expect(getByTestId('server-failure-server-1')).toBeTruthy()
      expect(getByTestId('server-header-retry-server-1')).toBeTruthy()
      expect(queryByTestId('server-failure-server-2')).toBeNull()
      expect(queryByTestId('server-offline-banner')).toBeNull()
      expect(getByTestId('conversation-row-c1')).toBeTruthy()
    } finally {
      useServerFetchStatusStore.getState().reset()
      useServersStore.setState({ activeServerIds: [], servers: {} })
    }
  })

  it('does not paint per-server failure panels when every host is down', async () => {
    useServersStore.setState({
      activeServerIds: ['server-1', 'server-2'],
      servers: {
        'server-1': { id: 'server-1', url: 'http://one', apiKey: 'k', label: 'MacBook Pro', isConnected: true, serverInfo: null, connectionError: null },
        'server-2': { id: 'server-2', url: 'http://two', apiKey: 'k', label: 'studio-linux', isConnected: true, serverInfo: null, connectionError: null },
      },
    })
    useServerFetchStatusStore.getState().recordFailure('server-1', new Error('offline'))
    useServerFetchStatusStore.getState().recordFailure('server-2', new Error('offline'))
    try {
      const older1 = asConv(conversation({ id: 'c1', serverId: 'server-1', sessionName: 'Report slow streamer requests' }), NOW - 5000)
      const older2 = asConv(conversation({ id: 'c2', serverId: 'server-2', sessionName: 'Nightly eval sweep, 200 prompts' }), NOW - 1000)
      const { getByTestId, queryByTestId } = await renderList([older1, older2])
      expect(queryByTestId('server-failure-server-1')).toBeNull()
      expect(queryByTestId('server-failure-server-2')).toBeNull()
      expect(getByTestId('conversation-row-c1')).toBeTruthy()
      expect(getByTestId('now-list-scroll')).toBeTruthy()
    } finally {
      useServerFetchStatusStore.getState().reset()
      useServersStore.setState({ activeServerIds: [], servers: {} })
    }
  })
})
