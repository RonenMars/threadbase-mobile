import React from 'react'
import { fireEvent, waitFor } from '@testing-library/react-native'
import { DrillView } from '@/components/sessions/tree/DrillView'
import { renderWithI18n } from '@/test-utils/render'
import i18n from '@/test-utils/i18n-setup'
import { useServersStore } from '@/stores/servers'
import type { TreeNode } from '@/components/sessions/tree/types'
import type { MultiSession } from '@/types/api'

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}))

jest.mock('@/hooks/useProjectConversations', () => ({
  useProjectConversations: () => ({
    conversations: [
      {
        id: 'c1',
        serverId: 'srv-1',
        title: 'Fix the resume collision copy',
        sessionName: 'Fix the resume collision copy',
        projectPath: '/home/user/dev/tb-mobile',
        messageCount: 4,
        lastActivity: new Date().toISOString(),
      },
    ],
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
  }),
}))

const session: MultiSession = {
  id: 'live',
  serverId: 'srv-1',
  status: 'running',
  ptyAttached: true,
  lifecycle: 'attached',
  subStatus: null,
  projectPath: '/home/user/dev/tb-mobile',
  projectName: 'tb-mobile',
  lastOutput: '',
  elapsedMs: 1000,
  promptCount: 1,
  startedAt: new Date().toISOString(),
}

function child(name: string, fullPath: string, extra: Partial<TreeNode> = {}): TreeNode {
  return {
    name,
    fullPath,
    children: new Map(),
    sessions: [],
    conversationCount: 0,
    conversationActivityMs: 0,
    totalCount: 0,
    directCount: 0,
    ...extra,
  }
}

const node: TreeNode = {
  name: 'dev',
  fullPath: '/home/user/dev',
  projectPath: '/home/user/dev',
  children: new Map([
    ['tb-mobile', child('tb-mobile', '/home/user/dev/tb-mobile', {
      projectPath: '/home/user/dev/tb-mobile',
      sessions: [session],
      conversationCount: 1,
      totalCount: 2,
      directCount: 2,
    })],
    ['tb-streamer', child('tb-streamer', '/home/user/dev/tb-streamer', {
      conversationCount: 12,
      totalCount: 12,
      conversationActivityMs: Date.now() - 3_600_000,
    })],
  ]),
  sessions: [],
  conversationCount: 0,
  conversationActivityMs: 0,
  totalCount: 14,
  directCount: 0,
}

describe('DrillView', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    useServersStore.setState({
      servers: {
        'srv-1': {
          id: 'srv-1',
          url: 'http://stub',
          apiKey: 'k',
          label: 'studio',
          isConnected: true,
          serverInfo: null,
          connectionError: null,
        },
      },
      activeServerIds: ['srv-1'],
      displayedServerIds: ['srv-1'],
    })
  })

  it('shows a machine breadcrumb, FOLDERS, and HERE', async () => {
    const { getByText, getByTestId } = await renderWithI18n(
      <DrillView node={node} serverId="srv-1" onBack={() => {}} />,
    )
    expect(getByText('studio · ~/user')).toBeTruthy()
    expect(getByText('dev')).toBeTruthy()
    expect(getByText('FOLDERS')).toBeTruthy()
    expect(getByText('tb-mobile')).toBeTruthy()
    expect(getByText('tb-streamer')).toBeTruthy()
    expect(getByTestId('drill-cwd-/home/user/dev')).toBeTruthy()
  })

  it('drills into a folder on tap', async () => {
    const { getByTestId, getByText, queryByText } = await renderWithI18n(
      <DrillView node={node} serverId="srv-1" onBack={() => {}} />,
    )
    fireEvent.press(getByTestId('drill-folder-tb-mobile'))
    await waitFor(() => expect(getByTestId('drill-cwd-/home/user/dev/tb-mobile')).toBeTruthy())
    expect(getByText('studio · ~/dev')).toBeTruthy()
    expect(getByText('HERE · 2 CONVERSATIONS')).toBeTruthy()
    expect(queryByText('tb-streamer')).toBeNull()
  })
})
