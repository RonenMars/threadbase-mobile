import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { useRouter } from 'expo-router'
import { SubagentBoard } from '@/components/sessions/SubagentBoard'
import { useViewPrefsStore } from '@/stores/viewPrefs'
import { createWrapper } from '@/test-utils'
import '@/test-utils/i18n-setup'

const mockGet = jest.fn()

jest.mock('@/services/api-client', () => ({
  createApiForServer: () => ({ get: (...a: unknown[]) => mockGet(...a) }),
}))

const sub = (id: string, parent: string, over: Record<string, unknown> = {}) => ({
  id,
  title: `title-${id}`,
  projectPath: '/p',
  messageCount: 4,
  lastActivity: new Date(Date.now() - 60_000).toISOString(),
  provider: 'claude-code',
  isSubagent: true,
  parentConversationId: parent,
  ...over,
})

const page = (conversations: unknown[]) => ({ conversations, hasMore: false, offset: 0, total: conversations.length })
const renderBoard = () =>
  render(<SubagentBoard serverIds={['s1']} parentTitles={new Map([['p1', 'Parent one']])} />, {
    wrapper: createWrapper(),
  })

beforeEach(() => {
  mockGet.mockReset()
  useViewPrefsStore.setState({ collapsedDayBuckets: ['last14Days', 'lastMonth', 'earlier'] })
})

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

const expand = async (r: Awaited<ReturnType<typeof renderBoard>>, parentId: string) => {
  await waitFor(() => expect(r.getByTestId(`subagent-group-toggle-${parentId}`)).toBeTruthy())
  await fireEvent.press(r.getByTestId(`subagent-group-toggle-${parentId}`))
}

describe('SubagentBoard', () => {
  it('requests every sub-agent in one call and groups them under their parent', async () => {
    mockGet.mockResolvedValue(page([sub('a', 'p1', { subagentActive: true }), sub('b', 'p1')]))
    const r = await renderBoard()
    await expand(r, 'p1')
    await waitFor(() => expect(r.getByTestId('conversation-row-a')).toBeTruthy())
    expect(mockGet.mock.calls[0][0]).toContain('include=subagents')
    expect(r.getByTestId('conversation-row-b')).toBeTruthy()
    expect(r.getByText('Parent one')).toBeTruthy()
    expect(r.queryByTestId('subagent-filter-active')).toBeNull()
  })

  it('puts groups with a running child under RUNNING and the rest under their day bucket', async () => {
    mockGet.mockResolvedValue(page([sub('a', 'p1', { subagentActive: true }), sub('b', 'p2')]))
    const r = await renderBoard()
    await waitFor(() => expect(r.getByText('RUNNING · 1')).toBeTruthy())
    expect(r.getByText('LAST 7 DAYS')).toBeTruthy()
    expect(r.getByTestId('subagent-group-toggle-p1')).toBeTruthy()
    expect(r.getByTestId('subagent-group-toggle-p2')).toBeTruthy()
  })

  it('collapses an old day bucket and reveals it when its eyebrow is pressed', async () => {
    mockGet.mockResolvedValue(page([sub('a', 'p1', { lastActivity: daysAgo(20) })]))
    const r = await renderBoard()
    await waitFor(() => expect(r.getByTestId('subagent-day-bucket-lastMonth')).toBeTruthy())
    expect(r.queryByTestId('subagent-group-toggle-p1')).toBeNull()
    await fireEvent.press(r.getByTestId('subagent-day-bucket-lastMonth'))
    expect(r.getByTestId('subagent-group-toggle-p1')).toBeTruthy()
  })

  it('starts every group collapsed and toggles its sub-agents like a project card', async () => {
    mockGet.mockResolvedValue(page([sub('a', 'p1'), sub('b', 'p1')]))
    const r = await renderBoard()
    await waitFor(() => expect(r.getByTestId('subagent-group-toggle-p1')).toBeTruthy())
    expect(r.getByText('Parent one')).toBeTruthy()
    expect(r.queryByTestId('conversation-row-a')).toBeNull()
    expect(r.getByTestId('subagent-group-toggle-p1').props.accessibilityState).toEqual({ expanded: false })

    await fireEvent.press(r.getByTestId('subagent-group-toggle-p1'))
    expect(r.getByTestId('conversation-row-a')).toBeTruthy()
    expect(r.getByTestId('subagent-group-toggle-p1').props.accessibilityState).toEqual({ expanded: true })

    await fireEvent.press(r.getByTestId('subagent-group-toggle-p1'))
    expect(r.queryByTestId('conversation-row-a')).toBeNull()
  })

  it('names a group from the row parentTitle when the parent is not a loaded session', async () => {
    mockGet.mockResolvedValue(page([sub('a', 'p9', { parentTitle: 'Runner session' }), sub('b', 'p8')]))
    const r = await renderBoard()
    await waitFor(() => expect(r.getByText('Runner session')).toBeTruthy())
    expect(r.getByTestId('subagent-group-toggle-p8')).toBeTruthy()
  })

  it('opens the transcript from a row and the parent from the group footer', async () => {
    const push = jest.fn()
    ;(useRouter as jest.Mock).mockReturnValue({ push, back: jest.fn(), replace: jest.fn() })
    mockGet.mockResolvedValue(page([sub('a', 'p1', { subagentActive: true })]))
    const r = await renderBoard()
    await expand(r, 'p1')
    await waitFor(() => expect(r.getByTestId('conversation-row-a')).toBeTruthy())
    await fireEvent.press(r.getByTestId('conversation-row-a'))
    expect(push).toHaveBeenLastCalledWith('/conversation/a?server=s1')
    await fireEvent.press(r.getByTestId('subagent-parent-p1'))
    expect(push).toHaveBeenLastCalledWith('/conversation/p1?server=s1')
  })

  describe('opening the parent', () => {
    const live = (over: Record<string, unknown> = {}) =>
      ({ id: 'sess-1', serverId: 's1', boundConversationId: 'p1', ptyAttached: true, status: 'running', ...over }) as never
    const openParent = async (liveSessions: unknown[]) => {
      const push = jest.fn()
      ;(useRouter as jest.Mock).mockReturnValue({ push, back: jest.fn(), replace: jest.fn() })
      mockGet.mockResolvedValue(page([sub('a', 'p1')]))
      const r = await render(
        <SubagentBoard serverIds={['s1']} parentTitles={new Map()} liveSessions={liveSessions as never[]} />,
        { wrapper: createWrapper() },
      )
      await expand(r, 'p1')
      await fireEvent.press(r.getByTestId('subagent-parent-p1'))
      return push
    }

    it('goes to the live session when the parent is attached and running', async () => {
      expect(await openParent([live()])).toHaveBeenLastCalledWith('/session/sess-1?server=s1')
    })

    it('matches on the conversation id when nothing is bound yet', async () => {
      const push = await openParent([live({ boundConversationId: undefined, conversationId: 'p1' })])
      expect(push).toHaveBeenLastCalledWith('/session/sess-1?server=s1')
    })

    it.each([
      ['detached', { ptyAttached: false }],
      ['idle', { status: 'idle' }],
      ['on another server', { serverId: 's2' }],
      ['another conversation', { boundConversationId: 'other' }],
    ])('opens the transcript when the session is %s', async (_n, over) => {
      expect(await openParent([live(over)])).toHaveBeenLastCalledWith('/conversation/p1?server=s1')
    })
  })

  it('falls back to a short id when the parent is not in the list', async () => {
    mockGet.mockResolvedValue(page([sub('a', 'abcdef123456', { subagentActive: true })]))
    const r = await renderBoard()
    await waitFor(() => expect(r.getByText('Session abcdef12')).toBeTruthy())
  })

  it('says so when the streamer ignores include=subagents (normal list returned)', async () => {
    mockGet.mockResolvedValue(page([{ ...sub('x', 'p1'), isSubagent: false, parentConversationId: undefined }]))
    const r = await renderBoard()
    await waitFor(() => expect(r.getByText("This server doesn't list sub-agents yet.")).toBeTruthy())
    expect(r.queryByTestId('conversation-row-x')).toBeNull()
  })

  it('keeps the board when one sub-agent has no parent, and leaves that row off', async () => {
    mockGet.mockResolvedValue(page([sub('a', 'p1', { subagentActive: true }), sub('b', 'p1'), sub('codex', 'p1', { parentConversationId: undefined })]))
    const r = await renderBoard()
    await expand(r, 'p1')
    await waitFor(() => expect(r.getByTestId('conversation-row-a')).toBeTruthy())
    expect(r.queryByText("This server doesn't list sub-agents yet.")).toBeNull()
    expect(r.queryByTestId('conversation-row-codex')).toBeNull()
    expect(r.getAllByText('2').length).toBeGreaterThan(0)
    expect(r.queryByText('3')).toBeNull()
  })

  it('shows the live dot only for an active sub-agent, with the type leading its meta line', async () => {
    mockGet.mockResolvedValue(page([sub('a', 'p1', { subagentActive: true, subagentType: 'Explore' }), sub('b', 'p1')]))
    const r = await renderBoard()
    await expand(r, 'p1')
    await waitFor(() => expect(r.getByTestId('conversation-row-a')).toBeTruthy())
    expect(r.getByTestId('subagent-board-active-a')).toBeTruthy()
    expect(r.queryByTestId('subagent-board-active-b')).toBeNull()
    expect(r.getByText(/Explore/)).toBeTruthy()
  })

  it('names a type every child shares once, in the group header, not on each row', async () => {
    mockGet.mockResolvedValue(page([sub('a', 'p1', { subagentType: 'Explore' }), sub('b', 'p1', { subagentType: 'Explore' })]))
    const r = await renderBoard()
    await expand(r, 'p1')
    await waitFor(() => expect(r.getByTestId('conversation-row-a')).toBeTruthy())
    expect(r.getAllByText(/Explore/)).toHaveLength(1)
  })

  it('shows three children, then all of them after Show all', async () => {
    mockGet.mockResolvedValue(
      page(['a', 'b', 'c', 'd', 'e'].map((id, i) => sub(id, 'p1', { lastActivity: new Date(Date.now() - (i + 1) * 60_000).toISOString() }))),
    )
    const r = await renderBoard()
    await expand(r, 'p1')
    await waitFor(() => expect(r.getByTestId('conversation-row-a')).toBeTruthy())
    expect(r.getByTestId('conversation-row-c')).toBeTruthy()
    expect(r.queryByTestId('conversation-row-d')).toBeNull()
    await fireEvent.press(r.getByTestId('subagent-show-all-p1'))
    expect(r.getByTestId('conversation-row-e')).toBeTruthy()
  })

  it('offers no Show all for a group of three or fewer', async () => {
    mockGet.mockResolvedValue(page([sub('a', 'p1'), sub('b', 'p1'), sub('c', 'p1')]))
    const r = await renderBoard()
    await expand(r, 'p1')
    await waitFor(() => expect(r.getByTestId('conversation-row-c')).toBeTruthy())
    expect(r.queryByTestId('subagent-show-all-p1')).toBeNull()
  })

  it('has no resume or input affordance', async () => {
    mockGet.mockResolvedValue(page([sub('b', 'p1')]))
    const r = await renderBoard()
    await expand(r, 'p1')
    await waitFor(() => expect(r.getByTestId('conversation-row-b')).toBeTruthy())
    expect(r.queryByText(/resume|send/i)).toBeNull()
  })
})
