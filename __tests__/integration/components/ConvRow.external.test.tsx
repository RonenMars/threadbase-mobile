/**
 * Conversation rows — externally-running indicator.
 *
 * A conversation an outside process is running arrives tagged with
 * `ownership: 'external'` and `processLiveness: 'alive'`; every other row (and
 * every row from an older streamer) carries neither field. The badge is the
 * same "Observed" tier the sessions list uses, and tapping still opens the
 * read-only conversation view.
 */
import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { ConvRow } from '@/components/sessions/hub/ConvRow'
import { ConversationList } from '@/components/conversation/ConversationList'
import type { MultiConversation } from '@/types/api'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}))

const makeConv = (overrides: Partial<MultiConversation> = {}): MultiConversation => ({
  id: 'conv-1',
  serverId: 'server-1',
  title: 'refactor the parser',
  projectPath: '/home/user/my-project',
  messageCount: 4,
  lastActivity: '2026-10-31T10:00:00.000Z',
  ...overrides,
})

const external = { ownership: 'external', processLiveness: 'alive' } as const

beforeEach(() => mockPush.mockClear())

describe('ConvRow — external liveness', () => {
  it('shows the badge and no action buttons for an external-alive row', async () => {
    const { getByText, getByTestId, getAllByRole } = await render(
      <ConvRow conv={makeConv(external)} />,
    )
    expect(getByText('Observed')).toBeTruthy()
    expect(getByTestId('state-badge-observed')).toBeTruthy()
    // The row itself is the only pressable: no resume / cancel / overtake / fork.
    expect(getAllByRole('button')).toHaveLength(1)
  })

  it('opens the read-only conversation view on tap', async () => {
    const { getByTestId } = await render(<ConvRow conv={makeConv(external)} />)
    await fireEvent.press(getByTestId('conversation-row-conv-1'))
    expect(mockPush).toHaveBeenCalledWith('/conversation/conv-1?server=server-1')
  })

  it('renders an older-streamer row (no fields) exactly as before', async () => {
    const { queryByText, queryByTestId } = await render(<ConvRow conv={makeConv()} />)
    expect(queryByText('Observed')).toBeNull()
    expect(queryByTestId('state-badge-observed')).toBeNull()
  })

  it('does not infer external from one field alone', async () => {
    const onlyOwnership = await render(<ConvRow conv={makeConv({ ownership: 'external' })} />)
    expect(onlyOwnership.queryByText('Observed')).toBeNull()
    const onlyLiveness = await render(<ConvRow conv={makeConv({ processLiveness: 'alive' })} />)
    expect(onlyLiveness.queryByText('Observed')).toBeNull()
  })

  it('drops the badge when the next refresh no longer carries the fields', async () => {
    const { getByText, queryByText, rerender } = await render(<ConvRow conv={makeConv(external)} />)
    expect(getByText('Observed')).toBeTruthy()
    await rerender(<ConvRow conv={makeConv()} />)
    expect(queryByText('Observed')).toBeNull()
  })

  it('treats gone / historical as not running', async () => {
    const { queryByText } = await render(
      <ConvRow conv={makeConv({ ownership: 'external', processLiveness: 'gone' })} />,
    )
    expect(queryByText('Observed')).toBeNull()
  })
})

describe('ConversationList (search results) — external liveness', () => {
  const renderList = (conversations: MultiConversation[]) =>
    render(
      <ThemeProvider>
        <ConversationList
          conversations={conversations}
          onRefresh={() => {}}
          refreshing={false}
          onEndReached={() => {}}
          searchQuery="parser"
          onSearchChange={() => {}}
          isLoadingInitial={false}
          isFetchingNextPage={false}
          loadingProgress={null}
        />
      </ThemeProvider>,
    )

  it('badges only the tagged search result', async () => {
    const { getByTestId, queryByTestId } = await renderList([
      makeConv({ id: 'tagged', ...external }),
      makeConv({ id: 'plain' }),
    ])
    expect(getByTestId('conversation-row-tagged')).toBeTruthy()
    expect(getByTestId('conversation-row-plain')).toBeTruthy()
    expect(queryByTestId('state-badge-observed')).toBeTruthy()
    const { within } = require('@testing-library/react-native')
    expect(within(getByTestId('conversation-row-tagged')).queryByTestId('state-badge-observed')).toBeTruthy()
    expect(within(getByTestId('conversation-row-plain')).queryByTestId('state-badge-observed')).toBeNull()
  })
})
