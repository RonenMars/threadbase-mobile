import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { useRouter } from 'expo-router'
import { SubagentBoard } from '@/components/sessions/SubagentBoard'
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
  lastActivity: '2026-10-24T10:00:00Z',
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

beforeEach(() => mockGet.mockReset())

const expand = async (r: Awaited<ReturnType<typeof renderBoard>>, parentId: string) => {
  await waitFor(() => expect(r.getByTestId(`subagent-group-toggle-${parentId}`)).toBeTruthy())
  await fireEvent.press(r.getByTestId(`subagent-group-toggle-${parentId}`))
}

describe('SubagentBoard', () => {
  it('requests every sub-agent in one call and defaults to all of them', async () => {
    mockGet.mockResolvedValue(page([sub('a', 'p1', { subagentActive: true }), sub('b', 'p1')]))
    const r = await renderBoard()
    await expand(r, 'p1')
    await waitFor(() => expect(r.getByTestId('conversation-row-a')).toBeTruthy())
    expect(mockGet.mock.calls[0][0]).toContain('include=subagents')
    expect(r.getByTestId('conversation-row-b')).toBeTruthy()
    expect(r.getByText('Parent one')).toBeTruthy()

    await fireEvent.press(r.getByTestId('subagent-filter-active'))
    await waitFor(() => expect(r.queryByTestId('conversation-row-b')).toBeNull())
  })

  it('lists All before Active', async () => {
    mockGet.mockResolvedValue(page([sub('a', 'p1')]))
    const r = await renderBoard()
    await waitFor(() => expect(r.getByTestId('subagent-filter-all')).toBeTruthy())
    const labels = r.getAllByTestId(/^subagent-filter-/).map((n) => n.props.testID)
    expect(labels).toEqual(['subagent-filter-all', 'subagent-filter-active'])
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

  it('opens the transcript from a row and the parent from the group header', async () => {
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

  it('shows the empty line when nothing is active, with no resume or input affordance', async () => {
    mockGet.mockResolvedValue(page([sub('b', 'p1')]))
    const r = await renderBoard()
    await waitFor(() => expect(r.queryByTestId('subagent-filter-active')).toBeTruthy())
    await fireEvent.press(r.getByTestId('subagent-filter-active'))
    await waitFor(() => expect(r.queryByTestId('conversation-row-b')).toBeNull())
    expect(r.queryByText(/resume|send/i)).toBeNull()
  })

  it('shows the live dot only for an active sub-agent and its type tag', async () => {
    mockGet.mockResolvedValue(page([sub('a', 'p1', { subagentActive: true, subagentType: 'Explore' }), sub('b', 'p1')]))
    const r = await renderBoard()
    await expand(r, 'p1')
    await waitFor(() => expect(r.getByTestId('conversation-row-a')).toBeTruthy())
    expect(r.getByTestId('subagent-board-active-a')).toBeTruthy()
    expect(r.queryByTestId('subagent-board-active-b')).toBeNull()
    expect(r.getByText('Explore')).toBeTruthy()
  })

  it('opens the sub-agent when its type tag is tapped', async () => {
    const push = jest.fn()
    ;(useRouter as jest.Mock).mockReturnValue({ push, back: jest.fn(), replace: jest.fn() })
    mockGet.mockResolvedValue(page([sub('a', 'p1', { subagentType: 'Explore' })]))
    const r = await renderBoard()
    await expand(r, 'p1')
    await waitFor(() => expect(r.getByText('Explore')).toBeTruthy())
    await fireEvent.press(r.getByText('Explore'))
    expect(push).toHaveBeenLastCalledWith('/conversation/a?server=s1')
  })
})
