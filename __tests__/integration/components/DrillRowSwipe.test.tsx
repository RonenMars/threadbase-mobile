import React from 'react'
import { fireEvent, screen } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DrillRow } from '@/components/sessions/tree/DrillRow'
import type { DrillItem } from '@/components/sessions/tree/types'
import { renderWithI18n } from '@/test-utils/render'
import { useQuickAccessStore } from '@/stores/quickAccess'
import type { MultiConversation, MultiSession } from '@/types/api'

declare global {
  var __renderSwipeActions: boolean | undefined
}

const session = (overrides: Partial<MultiSession> = {}): MultiSession => ({
  id: 'sid',
  serverId: 'server-1',
  status: 'waiting_input',
  ptyAttached: true,
  lifecycle: 'attached',
  subStatus: null,
  projectPath: '/home/user/tb-mobile',
  projectName: 'tb-mobile',
  branch: 'main',
  lastOutput: '',
  elapsedMs: 1000,
  promptCount: 1,
  startedAt: new Date().toISOString(),
  ...overrides,
})

const conv = {
  id: 'c1',
  serverId: 'server-1',
  title: 'Refactor the parser',
  lastActivity: new Date().toISOString(),
  messageCount: 3,
} as unknown as MultiConversation

const base: DrillItem = { key: 'k', label: 'Row label', timestamp: null, serverId: 'server-1', onPress: jest.fn() }

const renderRow = (item: DrillItem) =>
  renderWithI18n(
    <QueryClientProvider client={new QueryClient()}>
      <DrillRow item={item} />
    </QueryClientProvider>,
  )

beforeAll(() => {
  global.__renderSwipeActions = true
})
afterAll(() => {
  global.__renderSwipeActions = false
})
beforeEach(() => {
  useQuickAccessStore.setState({ favorites: [] })
})

describe('swipe on drill rows', () => {
  it('gives a live session the managed actions', async () => {
    await renderRow({ ...base, key: 'session:server-1::sid', session: session() })
    expect(screen.getByTestId('session-swipe-favorite')).toBeTruthy()
    expect(screen.getByTestId('session-swipe-rename')).toBeTruthy()
  })

  it('limits an external session to favorite and rename', async () => {
    await renderRow({ ...base, key: 'session:server-1::sid', session: session({ ownership: 'external' }) })
    expect(screen.getByTestId('session-swipe-favorite')).toBeTruthy()
    expect(screen.getByTestId('session-swipe-rename')).toBeTruthy()
    expect(screen.queryByTestId('session-swipe-terminate')).toBeNull()
  })

  it('favorites a conversation under the drill label', async () => {
    await renderRow({ ...base, key: 'conversation:server-1::c1', conversation: conv })
    await fireEvent.press(screen.getByTestId('conversation-swipe-favorite'))
    expect(useQuickAccessStore.getState().favorites).toEqual([
      expect.objectContaining({ type: 'conversation', id: 'server-1::conversation::c1', label: 'Row label' }),
    ])
  })

  it('leaves a row with no backing record unswipeable', async () => {
    await renderRow(base)
    expect(screen.queryByTestId('session-swipe-favorite')).toBeNull()
    expect(screen.queryByTestId('conversation-swipe-favorite')).toBeNull()
  })
})
