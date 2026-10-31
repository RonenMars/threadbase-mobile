/**
 * Conversation rows — "live outside Threadbase" indicator.
 *
 * A conversation whose CLI is running outside the app (processLiveness
 * 'alive') reuses the Observed tier of an external session. Tapping it still
 * opens the read-only conversation screen — never the Overtake/session route.
 */
import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { ConvRow } from '@/components/sessions/hub/ConvRow'
import { ConversationList } from '@/components/conversation/ConversationList'
import type { MultiConversation } from '@/types/api'
import i18n from '@/test-utils/i18n-setup'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}))

const makeConv = (overrides: Partial<MultiConversation> = {}): MultiConversation => ({
  id: 'c1',
  serverId: 'srv-1',
  title: 'Refactor the parser',
  projectPath: '/tmp/project',
  messageCount: 4,
  lastActivity: '2026-10-30T10:00:00.000Z',
  ...overrides,
})

const external: Partial<MultiConversation> = { ownership: 'external', processLiveness: 'alive' }

beforeEach(async () => {
  mockPush.mockClear()
  await i18n.changeLanguage('en')
})

describe('ConvRow (project hub, drill)', () => {
  it('marks a live-outside conversation as Observed', async () => {
    const { getByText } = await render(
      <ThemeProvider>
        <ConvRow conv={makeConv(external)} />
      </ThemeProvider>,
    )
    expect(getByText('Observed')).toBeTruthy()
  })

  it('renders exactly as before without the fields', async () => {
    const { queryByText } = await render(
      <ThemeProvider>
        <ConvRow conv={makeConv()} />
      </ThemeProvider>,
    )
    expect(queryByText('Observed')).toBeNull()
  })

  it('still opens the conversation screen, never the session/overtake route', async () => {
    const { getByTestId } = await render(
      <ThemeProvider>
        <ConvRow conv={makeConv(external)} />
      </ThemeProvider>,
    )
    fireEvent.press(getByTestId('conversation-row-c1'))
    expect(mockPush).toHaveBeenCalledTimes(1)
    expect(mockPush).toHaveBeenCalledWith('/conversation/c1?server=srv-1')
  })
})

describe('ConversationList (project screen, search results)', () => {
  const renderList = (conversations: MultiConversation[]) =>
    render(
      <ThemeProvider>
        <ConversationList
          conversations={conversations}
          onRefresh={() => {}}
          refreshing={false}
          onEndReached={() => {}}
          searchQuery=""
          onSearchChange={() => {}}
        />
      </ThemeProvider>,
    )

  it('marks only the live-outside row', async () => {
    const { getAllByText, getByTestId } = await renderList([
      makeConv({ id: 'live', ...external }),
      makeConv({ id: 'plain' }),
    ])
    expect(getAllByText('Observed')).toHaveLength(1)
    expect(getByTestId('conversation-row-live')).toBeTruthy()
  })

  it('shows no indicator without the fields', async () => {
    const { queryByText } = await renderList([makeConv({ id: 'plain' })])
    expect(queryByText('Observed')).toBeNull()
  })

  it('tapping a live-outside row routes to the conversation, not /session', async () => {
    const { getByTestId } = await renderList([makeConv({ id: 'live', ...external })])
    fireEvent.press(getByTestId('conversation-row-live'))
    const target = String(mockPush.mock.calls[0][0])
    expect(target).toContain('/conversation/live')
    expect(target).not.toContain('/session')
  })
})
