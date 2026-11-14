import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { useRouter } from 'expo-router'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { ProjectHubCard } from '@/components/sessions/hub/ProjectHubCard'
import { useServersStore } from '@/stores/servers'
import type { ProjectGroup } from '@/components/sessions/hub/useProjectGroups'
import type { MultiConversation, MultiSession } from '@/types/api'
import i18n from '@/test-utils/i18n-setup'

jest.mock('@/components/sessions/hub/SessionRow', () => {
  const React = require('react')
  const { Text } = require('react-native')
  return {
    SessionRow: ({ session }: { session: MultiSession }) =>
      React.createElement(Text, null, `session:${session.id}`),
  }
})

// The card fetches its own conversations now (expand-to-load), so the query
// hook stands in for the rows this test used to pass in via the group.
jest.mock('@/hooks/useProjectConversations', () => ({
  useProjectConversations: () => ({
    conversations: [conversation],
    isLoading: false,
  }),
}))

jest.mock('@/components/sessions/hub/ConvRow', () => {
  const React = require('react')
  const { Text } = require('react-native')
  return {
    ConvRow: ({ conv }: { conv: MultiConversation }) =>
      React.createElement(Text, null, `conversation:${conv.id}`),
  }
})

const session: MultiSession = {
  id: 'shared-id',
  serverId: 'srv-1',
  serverLabel: 'Server 1',
  status: 'running',
  ptyAttached: true,
  subStatus: null,
  projectId: 'project-1',
  projectPath: '/tmp/project',
  projectName: 'project',
  lastOutput: 'running',
  elapsedMs: 1000,
  promptCount: 1,
  startedAt: '2026-07-13T10:00:00.000Z',
}

const conversation: MultiConversation = {
  id: 'shared-id',
  serverId: 'srv-1',
  serverLabel: 'Server 1',
  title: 'project history',
  projectId: 'project-1',
  projectPath: '/tmp/project',
  messageCount: 2,
  lastActivity: '2026-07-13T10:01:00.000Z',
}

const group: ProjectGroup = {
  projectId: 'project-1',
  projectPath: '/tmp/project',
  projectName: 'project',
  serverId: 'srv-1',
  sessions: [session],
  conversationCount: 1,
  liveExternalCount: 0,
  latestActivityMs: Date.parse(conversation.lastActivity),
  earliestStartMs: Date.parse(session.startedAt),
}

function renderCard(isOpen = true, cardGroup: ProjectGroup = group) {
  return render(
    <ThemeProvider>
      <ProjectHubCard group={cardGroup} isOpen={isOpen} onToggle={() => {}} />
    </ThemeProvider>,
  )
}

describe('ProjectHubCard', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    useServersStore.setState({
      servers: {
        'srv-1': {
          id: 'srv-1',
          url: 'http://stub',
          apiKey: 'k',
          label: 'Server 1',
          isConnected: true,
          serverInfo: null,
          connectionError: null,
        },
      },
      activeServerIds: ['srv-1'],
      displayedServerIds: ['srv-1'],
    })
  })

  it('shows a live session once, not again as its own transcript', async () => {
    const { queryByText, getByText } = await renderCard()
    expect(getByText('session:shared-id')).toBeTruthy()
    expect(queryByText('conversation:shared-id')).toBeNull()
  })

  it('shows a held session once too', async () => {
    const held: ProjectGroup = { ...group, sessions: [{ ...session, status: 'idle', ptyAttached: false }] }
    const { queryByText, getByText } = await renderCard(true, held)
    expect(getByText('session:shared-id')).toBeTruthy()
    expect(queryByText('conversation:shared-id')).toBeNull()
  })

  const todayGroup: ProjectGroup = { ...group, sessions: [{ ...session, startedAt: new Date().toISOString() }] }

  it('prints the session today count on a closed card', async () => {
    const { getByText } = await renderCard(false, todayGroup)
    expect(getByText(/1 live · 1 today · last/)).toBeTruthy()
  })

  it('prints the today count once the card is open', async () => {
    const { getByText } = await renderCard(true, todayGroup)
    expect(getByText(/1 live · 1 today · last/)).toBeTruthy()
  })

  it('prefers needs-you over live on the activity line', async () => {
    const waitingGroup: ProjectGroup = {
      ...group,
      sessions: [{ ...session, status: 'waiting_input', ptyAttached: true, startedAt: new Date().toISOString() }],
    }
    const { getByText } = await renderCard(false, waitingGroup)
    expect(getByText(/1 needs you · 1 today · last/)).toBeTruthy()
  })

  it('caps the open preview at three rows', async () => {
    const many: ProjectGroup = {
      ...group,
      conversationCount: 0,
      sessions: [1, 2, 3, 4].map((n) => ({ ...session, id: `s${n}`, startedAt: `2026-07-13T10:0${n}:00.000Z` })),
    }
    const { queryByText, getByText } = await renderCard(true, many)
    expect(getByText('session:s4')).toBeTruthy()
    expect(getByText('session:s3')).toBeTruthy()
    expect(getByText('session:s2')).toBeTruthy()
    expect(queryByText('session:s1')).toBeNull()
  })

  it('opens the project screen on the card\'s own server', async () => {
    const push = jest.fn()
    ;(useRouter as jest.Mock).mockReturnValue({ push })
    const more: ProjectGroup = { ...group, serverId: 'srv-2', conversationCount: 9 }
    const { getByTestId } = await renderCard(true, more)
    fireEvent.press(getByTestId('hub-see-all-/tmp/project'))
    expect(push).toHaveBeenCalledWith('/project/project-1?path=%2Ftmp%2Fproject&server=srv-2')
  })

  it('labels live outside conversations as external, not live', async () => {
    const live: ProjectGroup = { ...group, sessions: [], liveExternalCount: 2 }
    const { getByText, queryByText } = await renderCard(false, live)
    expect(getByText(/2 external/)).toBeTruthy()
    expect(queryByText(/live/)).toBeNull()
  })

  it('does not read 1 live for a card with one external session only', async () => {
    const one: ProjectGroup = { ...group, sessions: [], liveExternalCount: 1 }
    const { getByText, queryByText } = await renderCard(false, one)
    expect(getByText(/1 external/)).toBeTruthy()
    expect(queryByText(/1 live/)).toBeNull()
  })

  it('counts a live external session in the group as external, not live', async () => {
    const ext: ProjectGroup = {
      ...group,
      liveExternalCount: 0,
      sessions: [{ ...session, ownership: 'external', processLiveness: 'alive', ptyAttached: false }],
    }
    const { getByText, queryByText } = await renderCard(false, ext)
    expect(getByText(/1 external/)).toBeTruthy()
    expect(queryByText(/live/)).toBeNull()
  })

  it('shows live and external side by side', async () => {
    const both: ProjectGroup = { ...todayGroup, liveExternalCount: 2 }
    const { getByText } = await renderCard(false, both)
    expect(getByText(/1 live · 2 external · 1 today · last/)).toBeTruthy()
  })

  it('keeps needs-you ahead of live and still shows external', async () => {
    const waiting: ProjectGroup = {
      ...group,
      liveExternalCount: 2,
      sessions: [{ ...session, status: 'waiting_input', ptyAttached: true, startedAt: new Date().toISOString() }],
    }
    const { getByText } = await renderCard(false, waiting)
    expect(getByText(/1 needs you · 2 external · 1 today · last/)).toBeTruthy()
  })

  it('shows no live or external count when the project has none outside', async () => {
    const quiet: ProjectGroup = { ...group, sessions: [], liveExternalCount: 0 }
    const { queryByText } = await renderCard(false, quiet)
    expect(queryByText(/live|external/)).toBeNull()
  })
})
