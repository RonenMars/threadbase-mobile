import React from 'react'
import QuietSessionsScreen from '@/app/quiet-sessions'
import { useQuietTailStore } from '@/stores/quietTail'
import { renderWithI18n } from '@/test-utils/render'
import type { MultiConversation } from '@/types/api'

jest.mock('@/hooks/useSessionActions', () => ({
  useSessionActions: () => ({
    cancelSession: { mutate: jest.fn(), isPending: false },
    sendInput: { mutate: jest.fn(), isPending: false },
    addToQueue: { mutate: jest.fn(), isPending: false },
    removeFromQueue: { mutate: jest.fn(), isPending: false },
  }),
}))

const conversation = (id: string, sessionName: string): MultiConversation => ({
  id,
  serverId: 'server-1',
  title: 'tb-mobile',
  sessionName,
  projectPath: '/home/user/tb-mobile',
  branch: 'main',
  messageCount: 1,
  lastActivity: new Date(Date.now() - 120_000).toISOString(),
})

describe('QuietSessionsScreen', () => {
  afterEach(() => {
    useQuietTailStore.getState().clear()
  })

  it('lists the handed-over rows in their original order', async () => {
    useQuietTailStore.getState().set([
      { item: { kind: 'conversation', ms: Date.now() - 1000, item: conversation('a', 'git pull') }, title: 'git pull' },
      { item: { kind: 'conversation', ms: Date.now() - 2000, item: conversation('b', 'hi') }, title: 'tb-mobile · main' },
    ])
    const { getByTestId, getByText } = await renderWithI18n(<QuietSessionsScreen />)
    expect(getByTestId('conversation-row-a')).toBeTruthy()
    expect(getByTestId('conversation-row-b')).toBeTruthy()
    expect(getByText(/^git pull/)).toBeTruthy()
    const ids = (getByTestId('quiet-sessions-screen').props.children.props.data as { item: { item: { id: string } } }[]).map(
      (e) => e.item.item.id,
    )
    expect(ids).toEqual(['a', 'b'])
  })
})
