import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { PhoneBoard } from '@/components/sessions/board/PhoneBoard'
import type { MergedItem } from '@/components/sessions/now/mergedItems'
import { useServersStore } from '@/stores/servers'
import { createWrapper } from '@/test-utils'
import '@/test-utils/i18n-setup'
import type { Conversation, ConversationPage, MultiConversation, MultiSession } from '@/types/api'

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}))

jest.mock('@/hooks/useSessionActions', () => ({
  useSessionActions: () => ({
    stopSession: { mutate: jest.fn(), isPending: false },
    stopWhenIdle: { mutateAsync: jest.fn(), isPending: false },
    sendInput: { mutate: jest.fn(), isPending: false },
  }),
}))

const mockGet = jest.fn<Promise<ConversationPage>, []>()
jest.mock('@/services/api-client', () => ({
  createApiForServer: () => ({ get: () => mockGet() }),
}))

const NOW = Date.now()
beforeAll(() => jest.spyOn(Date, 'now').mockReturnValue(NOW))
afterAll(() => jest.restoreAllMocks())

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

const sub = (id: string, parent: string, active: boolean): Conversation => ({
  id,
  title: `title-${id}`,
  projectPath: '/p',
  messageCount: 2,
  lastActivity: new Date(NOW - 30_000).toISOString(),
  isSubagent: true,
  parentConversationId: parent,
  subagentDescription: `Sub ${id}`,
  subagentActive: active,
})

const running = session({ id: 'r', status: 'running', ptyAttached: true, lifecycle: 'attached', sessionName: 'Scan the worktrees' })
const history = conversation({ id: 'h' })
const items: MergedItem[] = [
  { kind: 'session', ms: NOW - 1000, item: running },
  { kind: 'conversation', ms: NOW - 120_000, item: history },
]

const renderBoard = (list: MergedItem[] = items) =>
  render(
    <PhoneBoard items={list} searchQuery="" conversationsFromServer={false} refreshing={false} onRefresh={jest.fn()} />,
    { wrapper: createWrapper() },
  )

beforeEach(() => {
  useServersStore.setState({ activeServerIds: ['server-1'] })
  mockGet.mockReset()
  mockGet.mockResolvedValue({ conversations: [], hasMore: false, offset: 0, total: 0 })
})

describe('PhoneBoard', () => {
  it('opens on the first column with sessions and counts every column', async () => {
    const r = await renderBoard()
    expect(r.getByTestId('board-column-working').props.accessibilityState).toEqual({ selected: true })
    expect(r.getByText('Scan the worktrees')).toBeTruthy()
    expect(r.queryByTestId('conversation-row-h')).toBeNull()
    expect(r.getByTestId('board-column-earlier')).toHaveTextContent('Earlier1')
  })

  it('switches column from a chip and shows one line for an empty column', async () => {
    const r = await renderBoard()
    await fireEvent.press(r.getByTestId('board-column-earlier'))
    expect(r.getByTestId('conversation-row-h')).toBeTruthy()
    await fireEvent.press(r.getByTestId('board-column-needsYou'))
    expect(r.getByText('Nothing here')).toBeTruthy()
  })

  it('folds sub-agents under the session that spawned them, closed until tapped', async () => {
    mockGet.mockResolvedValue({
      conversations: [sub('a1', 'r', true), sub('a2', 'r', false), sub('x', 'elsewhere', true)],
      hasMore: false,
      offset: 0,
      total: 3,
    })
    const r = await renderBoard()
    await waitFor(() => expect(r.getByTestId('board-subagents-toggle-r')).toBeTruthy())
    expect(r.getByText('Sub-agents (2)')).toBeTruthy()
    expect(r.getByText('1 active')).toBeTruthy()
    expect(r.queryByTestId('conversation-row-a1')).toBeNull()
    await fireEvent.press(r.getByTestId('board-subagents-toggle-r'))
    expect(r.getByTestId('conversation-row-a1')).toBeTruthy()
    expect(r.getByTestId('conversation-row-a2')).toBeTruthy()
    // A group whose parent is not on the board stays on the Sub-agents tab.
    expect(r.queryByTestId('board-subagents-elsewhere')).toBeNull()
  })
})
