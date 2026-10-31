import React from 'react'
import { render } from '@testing-library/react-native'
import { BoardSessionCard } from '@/components/sessions/board/BoardSessionCard'
import type { NowEntry } from '@/components/sessions/now/nowEntries'
import { createWrapper } from '@/test-utils'
import '@/test-utils/i18n-setup'
import type { MultiConversation, SearchMatch } from '@/types/api'

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}))

const match: SearchMatch = { field: 'content', snippet: 'we fixed the zebra crossing bug', highlights: [{ start: 13, end: 18 }] }

async function renderCard(matches: SearchMatch[] | undefined, searchQuery: string) {
  const conversation = {
    id: 'c1',
    serverId: 's1',
    title: 'Some chat',
    projectPath: '/dev/app',
    messageCount: 4,
    lastActivity: new Date(Date.now() - 60_000).toISOString(),
    matches,
  } as MultiConversation
  const entry = {
    item: { kind: 'conversation', ms: Date.now() - 60_000, item: conversation },
    tier: null,
    title: { title: 'Some chat', rung: 'intent' },
    statusLabel: null,
  } as NowEntry
  return await render(
    <BoardSessionCard
      id="c1"
      entry={entry}
      group={undefined}
      isOpen={false}
      onToggle={() => {}}
      onShowQuestion={() => {}}
      serverIdFor={() => 's1'}
      searchQuery={searchQuery}
    />,
    { wrapper: createWrapper() },
  )
}

describe('BoardSessionCard match snippet', () => {
  it('shows the first match snippet when searching', async () => {
    const { getByTestId } = await renderCard([match], 'zebra')
    expect(getByTestId('search-snippet')).toBeTruthy()
  })

  it('shows nothing without matches', async () => {
    expect((await renderCard(undefined, 'zebra')).queryByTestId('search-snippet')).toBeNull()
  })

  it('shows nothing without an active query', async () => {
    expect((await renderCard([match], '  ')).queryByTestId('search-snippet')).toBeNull()
  })
})
