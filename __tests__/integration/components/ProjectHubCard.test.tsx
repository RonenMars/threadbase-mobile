import React from 'react'
import { render } from '@testing-library/react-native'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { ProjectHubCard } from '@/components/sessions/hub/ProjectHubCard'
import { useSettingsStore } from '@/stores/settings'
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
  latestActivityMs: Date.parse(conversation.lastActivity),
  earliestStartMs: Date.parse(session.startedAt),
}

function renderCard() {
  return render(
    <ThemeProvider>
      <ProjectHubCard group={group} isOpen onToggle={() => {}} />
    </ThemeProvider>,
  )
}

describe('ProjectHubCard', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    useSettingsStore.setState({ mergeChats: true })
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

  it('uses distinct keys when merged sessions and conversations share an id', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    try {
      renderCard()
    } finally {
      const duplicateKeyWarning = errorSpy.mock.calls.find((args) =>
        args.some((arg) => typeof arg === 'string' && arg.includes('same key')),
      )
      errorSpy.mockRestore()
      expect(duplicateKeyWarning).toBeUndefined()
    }
  })

  it('localizes the unmerged home-card section labels', async () => {
    useSettingsStore.setState({ mergeChats: false })
    await i18n.changeLanguage('he')

    const { getByText, queryByText } = await renderCard()

    expect(getByText('סשנים')).toBeTruthy()
    expect(getByText('שיחות')).toBeTruthy()
    expect(getByText(/1 פעילים · אחרון:/)).toBeTruthy()
    expect(queryByText('SESSIONS')).toBeNull()
    expect(queryByText('CONVERSATIONS')).toBeNull()
    expect(queryByText(/1 live · last/)).toBeNull()
  })
})
