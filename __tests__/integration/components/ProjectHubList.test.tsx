import React from 'react'
import { fireEvent, waitFor } from '@testing-library/react-native'
import { ProjectHubList } from '@/components/sessions/hub/ProjectHubList'
import type { MultiProjectSummary } from '@/hooks/useProjectSummaries'
import { renderWithI18n } from '@/test-utils/render'
import i18n from '@/test-utils/i18n-setup'
import type { MultiSession } from '@/types/api'

jest.mock('@/hooks/useConversations', () => ({
  useConversationSearch: () => ({ data: undefined }),
}))

jest.mock('@/hooks/useProjectConversations', () => ({
  useProjectConversations: () => ({ conversations: [], isLoading: false }),
}))

const NOW = Date.now()
const DAY = 86_400_000

function summary(name: string, ageMs: number): MultiProjectSummary {
  return {
    serverId: 'srv-1',
    path: `/home/user/${name}`,
    name,
    conversationCount: 4,
    lastActivity: new Date(NOW - ageMs).toISOString(),
  }
}

const liveSession: MultiSession = {
  id: 'live',
  serverId: 'srv-1',
  status: 'running',
  ptyAttached: true,
  lifecycle: 'attached',
  subStatus: null,
  projectPath: '/home/user/live-app',
  projectName: 'live-app',
  lastOutput: '',
  elapsedMs: 1000,
  promptCount: 1,
  startedAt: new Date(NOW - 60_000).toISOString(),
}

function renderHub(sessions: MultiSession[], summaries: MultiProjectSummary[]) {
  return renderWithI18n(
    <ProjectHubList
      sessions={sessions}
      summaries={summaries}
      sortBy="lastActivity"
      sortOrder="desc"
      refreshing={false}
      onRefresh={() => {}}
      searchOpen={false}
      searchQuery=""
    />,
  )
}

beforeEach(async () => {
  await i18n.changeLanguage('en')
})

describe('ProjectHubList tiers', () => {
  it('splits projects into ACTIVE, RECENT and a folded QUIET tail, and unfolds on Show', async () => {
    const { getByText, getByTestId, queryByTestId, getAllByTestId } = await renderHub(
      [liveSession],
      [summary('fresh', DAY), summary('old-one', 40 * DAY), summary('old-two', 90 * DAY)],
    )
    expect(getByText('ACTIVE · 1')).toBeTruthy()
    expect(getByText('RECENT')).toBeTruthy()
    expect(getByText('QUIET · 2')).toBeTruthy()
    expect(getByTestId('hub-quiet-chips')).toBeTruthy()
    // The chip carries the card's id, so a flow reaching for the project still finds it.
    expect(getAllByTestId('hub-project-old-one')).toHaveLength(1)

    fireEvent.press(getByTestId('hub-quiet-toggle-all'))
    await waitFor(() => expect(queryByTestId('hub-quiet-chips')).toBeNull())
    expect(getByText('Hide')).toBeTruthy()
    expect(getByTestId('hub-project-old-two')).toBeTruthy()
  })

  it('shows the tail as cards when there is nothing above it to fold under', async () => {
    const { queryByTestId, getByTestId, queryByText } = await renderHub([], [summary('old-one', 40 * DAY)])
    expect(queryByTestId('hub-quiet-chips')).toBeNull()
    expect(getByTestId('hub-project-old-one')).toBeTruthy()
    expect(queryByText('Show')).toBeNull()
  })

  it('narrows the cards with the path filter', async () => {
    const { getByTestId, queryByText, getByText } = await renderHub(
      [liveSession],
      [summary('fresh', DAY), summary('old-one', 40 * DAY)],
    )
    fireEvent.changeText(getByTestId('hub-project-filter'), 'old')
    await waitFor(() => expect(queryByText('ACTIVE · 1')).toBeNull())
    expect(queryByText('RECENT')).toBeNull()
    expect(getByText('QUIET · 1')).toBeTruthy()
    expect(getByTestId('hub-project-old-one')).toBeTruthy()
  })
})
