import React from 'react'
import { act } from 'react'
import { Keyboard } from 'react-native'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { useRouter } from 'expo-router'
import { SubagentSection } from '@/components/conversation/SubagentSection'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SUBAGENT_COUNT_POLL_MS, applySubagentsChanged } from '@/hooks/useSubagents'
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
  it('fetches only the count (limit=1), never the list, while collapsed, and shows it', async () => {
    mockGet.mockResolvedValue({ conversations: [child('a')], hasMore: true, offset: 0, total: 2 })
    const r = await render(<SubagentSection serverId="s1" parentId="p1" />, { wrapper: createWrapper() })
    await waitFor(() => expect(r.getByText('Sub-agents (2)')).toBeTruthy())
    expect(mockGet).toHaveBeenCalledTimes(1)
    expect(mockGet.mock.calls[0][0]).toBe('/api/conversations?parent=p1&limit=1')
    expect(r.queryByTestId('subagent-row-a')).toBeNull()
  })

  it('moves the collapsed header when subagents_changed is applied for this parent only', async () => {
    mockGet.mockResolvedValue({ conversations: [child('a')], hasMore: true, offset: 0, total: 2 })
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )
    const r = await render(<SubagentSection serverId="s1" parentId="p1" />, { wrapper })
    await waitFor(() => expect(r.getByText('Sub-agents (2)')).toBeTruthy())

    // React Query notifies observers on a timer, so let it flush before asserting "unchanged".
    const apply = (serverId: string, parentId: string, total: number) =>
      act(async () => {
        applySubagentsChanged(qc, serverId, parentId, total)
        await new Promise((res) => setTimeout(res, 20))
      })
    await apply('s1', 'other', 9)
    await apply('s2', 'p1', 8)
    expect(r.getByText('Sub-agents (2)')).toBeTruthy()
    expect(qc.getQueryData(['subagent-count', 's1', 'other'])).toBeUndefined()

    await apply('s1', 'p1', 3)
    await waitFor(() => expect(r.getByText('Sub-agents (3)')).toBeTruthy())
  })

  it('polls the count as a fallback when no frame arrives', async () => {
    jest.useFakeTimers()
    try {
      mockGet.mockResolvedValueOnce({ conversations: [child('a')], hasMore: true, offset: 0, total: 1 })
      mockGet.mockResolvedValue({ conversations: [child('a')], hasMore: true, offset: 0, total: 2 })
      const r = await render(<SubagentSection serverId="s1" parentId="p1" />, { wrapper: createWrapper() })
      await waitFor(() => expect(r.getByText('Sub-agents (1)')).toBeTruthy())
      await act(async () => {
        jest.advanceTimersByTime(SUBAGENT_COUNT_POLL_MS + 100)
      })
      await waitFor(() => expect(r.getByText('Sub-agents (2)')).toBeTruthy())
    } finally {
      jest.useRealTimers()
    }
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

  it('dismisses the keyboard on open and scrolls the list inside a capped height', async () => {
    mockGet.mockResolvedValue({ conversations: [child('a')], hasMore: false, offset: 0, total: 1 })
    const dismiss = jest.spyOn(Keyboard, 'dismiss')
    const r = await render(<SubagentSection serverId="s1" parentId="p1" />, { wrapper: createWrapper() })
    await waitFor(() => expect(r.getByText('Sub-agents (1)')).toBeTruthy())
    fireEvent.press(r.getByTestId('subagent-toggle'))
    expect(dismiss).toHaveBeenCalledTimes(1)
    const list = await r.findByTestId('subagent-list')
    expect(list.props.style.maxHeight).toBeGreaterThan(0)
    expect(r.getByTestId('subagent-row-a')).toBeTruthy()
    dismiss.mockRestore()
  })
})
