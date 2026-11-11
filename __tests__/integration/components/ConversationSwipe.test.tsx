import React from 'react'
import { StyleSheet } from 'react-native'
import { fireEvent, screen } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConvRow } from '@/components/sessions/hub/ConvRow'
import { SessionRow } from '@/components/sessions/hub/SessionRow'
import { ConversationList } from '@/components/conversation/ConversationList'
import { renderWithI18n } from '@/test-utils/render'
import { useQuickAccessStore } from '@/stores/quickAccess'
import type { MultiConversation, MultiSession } from '@/types/api'

declare global {
  var __renderSwipeActions: boolean | undefined
}

const conv = {
  id: 'c1',
  serverId: 'server-1',
  title: 'Refactor the parser',
  lastActivity: new Date().toISOString(),
  messageCount: 3,
} as unknown as MultiConversation

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

const renderRow = (ui: React.ReactElement) =>
  renderWithI18n(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>)

beforeAll(() => {
  global.__renderSwipeActions = true
})
afterAll(() => {
  global.__renderSwipeActions = false
})
beforeEach(() => {
  useQuickAccessStore.setState({ favorites: [] })
})

describe('swipe on project hub rows', () => {
  it('favorites a conversation and offers nothing else', async () => {
    await renderRow(<ConvRow conv={conv} />)
    expect(screen.queryByTestId('session-swipe-rename')).toBeNull()
    await fireEvent.press(screen.getByTestId('conversation-swipe-favorite'))
    expect(useQuickAccessStore.getState().favorites).toEqual([
      expect.objectContaining({ type: 'conversation', id: 'server-1::conversation::c1', conversationId: 'c1', serverId: 'server-1' }),
    ])
    await fireEvent.press(screen.getByTestId('conversation-swipe-favorite'))
    expect(useQuickAccessStore.getState().favorites).toEqual([])
  })

  it('puts the managed session actions on a session row', async () => {
    await renderRow(<SessionRow session={session()} />)
    expect(screen.getByTestId('session-swipe-favorite')).toBeTruthy()
    expect(screen.getByTestId('session-swipe-rename')).toBeTruthy()
  })

  it('limits an external session row to favorite and rename', async () => {
    await renderRow(<SessionRow session={session({ ownership: 'external' })} />)
    expect(screen.getByTestId('session-swipe-favorite')).toBeTruthy()
    expect(screen.getByTestId('session-swipe-rename')).toBeTruthy()
    expect(screen.queryByTestId('session-swipe-terminate')).toBeNull()
  })
})

describe('swipe on the all-conversations list', () => {
  it('favorites a conversation row and offers nothing else', async () => {
    await renderRow(
      <ConversationList
        conversations={[conv]}
        onRefresh={jest.fn()}
        refreshing={false}
        onEndReached={jest.fn()}
        searchQuery=""
        onSearchChange={jest.fn()}
        searchOpen={false}
      />,
    )
    expect(screen.queryByTestId('session-swipe-rename')).toBeNull()
    // Same compact circle as the hub rows, not the full-size card button.
    const circle = screen.getByTestId('conversation-swipe-favorite').children[0]
    expect(typeof circle !== 'string' && StyleSheet.flatten(circle.props.style).height).toBe(32)
    await fireEvent.press(screen.getByTestId('conversation-swipe-favorite'))
    expect(useQuickAccessStore.getState().favorites).toEqual([
      expect.objectContaining({ type: 'conversation', id: 'server-1::conversation::c1', label: 'Refactor the parser' }),
    ])
  })
})
