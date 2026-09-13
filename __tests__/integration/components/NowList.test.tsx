import React from 'react'
import { NowList } from '@/components/sessions/now/NowList'
import type { MergedItem } from '@/components/sessions/now/mergedItems'
import { renderWithI18n } from '@/test-utils/render'
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

function renderList(items: MergedItem[], order: 'state' | 'lastActivity' | 'projectName' = 'state') {
  return renderWithI18n(
    <NowList
      items={items}
      order={order}
      refreshing={false}
      onRefresh={() => {}}
      searchQuery=""
      conversationsFromServer={false}
      onSearchChange={() => {}}
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

  it('folds three or more rejected-title rows into one grouped row', async () => {
    const noise = ['hi', 'hey', 'Ahoy'].map((name, i) =>
      asConv(conversation({ id: `n${i}`, sessionName: name, title: name }), NOW - 1000 * (i + 1)),
    )
    const real = asConv(conversation({ id: 'real', sessionName: 'Fix the resume collision copy' }), NOW - 500)
    const { getByText, queryByTestId, getByTestId } = await renderList([real, ...noise])

    expect(getByText('3 one-line sessions')).toBeTruthy()
    expect(getByText('GROUPED')).toBeTruthy()
    expect(getByTestId('conversation-row-real')).toBeTruthy()
    expect(queryByTestId('conversation-row-n0')).toBeNull()
  })

  it('drops the sections in Recent order but keeps live rows as cards', async () => {
    const waiting = session({ id: 'w', status: 'waiting_input', ptyAttached: true, lifecycle: 'attached', sessionName: 'Why sessions open in terminal view' })
    const { queryByText, getByTestId } = await renderList([asItem(waiting)], 'lastActivity')
    expect(queryByText('NEEDS YOU · 1')).toBeNull()
    expect(getByTestId('first-session-card')).toBeTruthy()
    expect(queryByText('Needs you')).toBeTruthy()
  })

  it('keeps two rejected titles as plain rows', async () => {
    const items = ['hi', 'hey'].map((name, i) => asConv(conversation({ id: `n${i}`, sessionName: name, title: name })))
    const { queryByText, getByTestId } = await renderList(items)
    expect(queryByText('GROUPED')).toBeNull()
    expect(getByTestId('conversation-row-n0')).toBeTruthy()
  })
})
