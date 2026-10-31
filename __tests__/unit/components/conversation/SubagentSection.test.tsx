import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { useRouter } from 'expo-router'
import { SubagentSection } from '@/components/conversation/SubagentSection'
import { createWrapper } from '@/test-utils'
import '@/test-utils/i18n-setup'

const mockGet = jest.fn()

jest.mock('@/services/api-client', () => ({
  createApiForServer: () => ({ get: (...a: unknown[]) => mockGet(...a) }),
}))

const child = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  title: `title-${id}`,
  projectPath: '/p',
  messageCount: 4,
  lastActivity: '2026-10-24T10:00:00Z',
  provider: 'claude-code',
  isSubagent: true,
  parentConversationId: 'p1',
  ...over,
})

beforeEach(() => mockGet.mockReset())

describe('SubagentSection', () => {
  it('fetches nothing while collapsed', async () => {
    const r = await render(<SubagentSection serverId="s1" parentId="p1" />, { wrapper: createWrapper() })
    expect(mockGet).not.toHaveBeenCalled()
    expect(r.getByTestId('subagent-toggle')).toBeTruthy()
  })

  it('on expand lists children with label fallback, type tag and active dot, and opens read-only on tap', async () => {
    const push = jest.fn()
    ;(useRouter as jest.Mock).mockReturnValue({ push, back: jest.fn(), replace: jest.fn() })
    mockGet.mockResolvedValue({
      conversations: [
        child('a', { subagentDescription: 'Fix tests', subagentType: 'Explore', subagentActive: true }),
        child('b'),
      ],
      hasMore: false,
      offset: 0,
      total: 2,
    })
    const r = await render(<SubagentSection serverId="s1" parentId="p1" />, { wrapper: createWrapper() })
    fireEvent.press(r.getByTestId('subagent-toggle'))
    await waitFor(() => expect(r.getByTestId('subagent-row-a')).toBeTruthy())

    expect(r.getByText('Fix tests')).toBeTruthy()
    expect(r.getByText('Explore')).toBeTruthy()
    expect(r.getByText('title-b')).toBeTruthy()
    expect(r.getByTestId('subagent-active-a')).toBeTruthy()
    expect(r.queryByTestId('subagent-active-b')).toBeNull()
    expect(r.getByText('Sub-agents (2)')).toBeTruthy()
    expect(r.getAllByText(/ · 4 messages · /)).toHaveLength(2)

    fireEvent.press(r.getByTestId('subagent-row-a'))
    expect(push).toHaveBeenCalledWith('/conversation/a?server=s1')
  })

  it('offers no resume, send or status affordance on a sub-agent row', async () => {
    mockGet.mockResolvedValue({ conversations: [child('a')], hasMore: false, offset: 0, total: 1 })
    const r = await render(<SubagentSection serverId="s1" parentId="p1" />, { wrapper: createWrapper() })
    fireEvent.press(r.getByTestId('subagent-toggle'))
    await waitFor(() => expect(r.getByTestId('subagent-row-a')).toBeTruthy())
    expect(r.queryByTestId('resume-button')).toBeNull()
    expect(r.queryByTestId('session-status-badge')).toBeNull()
    expect(r.queryByText(/resume|running|waiting/i)).toBeNull()
  })

  it('shows one plain line and no rows when the streamer ignored parent=', async () => {
    mockGet.mockResolvedValue({
      conversations: [{ id: 'x', title: 'Unrelated', projectPath: '/p', messageCount: 1, lastActivity: '' }],
      hasMore: false,
      offset: 0,
      total: 1,
    })
    const r = await render(<SubagentSection serverId="s1" parentId="p1" />, { wrapper: createWrapper() })
    fireEvent.press(r.getByTestId('subagent-toggle'))
    await waitFor(() => expect(r.getByText("This server doesn't support sub-agents yet.")).toBeTruthy())
    expect(r.queryByText('Unrelated')).toBeNull()
  })
})
