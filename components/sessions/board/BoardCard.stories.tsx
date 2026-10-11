import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { BoardCard, BoardConversationCard } from './BoardCard'
import type { MultiSession } from '@/types/api'

const session: MultiSession = {
  id: 's3',
  serverId: 'server-1',
  status: 'idle',
  ptyAttached: false,
  subStatus: null,
  projectPath: '/Users/me/dev/ai-tools/tb-mobile',
  projectName: 'tb-mobile',
  branch: 'feat/web-session-board',
  model: 'Opus 4.8',
  lastOutput: '',
  elapsedMs: 12 * 60_000,
  promptCount: 4,
  startedAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
}

const meta: Meta<typeof BoardCard> = {
  title: 'sessions/board/BoardCard',
  component: BoardCard,
  decorators: [
    (Story) => (
      <View style={{ padding: 16, width: 340 }}>
        <Story />
      </View>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof BoardCard>

export const Resumable: Story = {
  args: { session, title: 'Add a kanban board of sessions', tier: 'resumable' },
}

export const CantResume: Story = {
  args: {
    session: { ...session, lifecycle: 'failed', failureReason: 'Process exited with code 1' },
    title: 'Rebase the release branch',
    tier: 'cantResume',
    serverLabel: 'studio-linux',
    serverColor: '#a371f7',
  },
}

export const Observed: Story = {
  args: {
    session: { ...session, status: 'running', ownership: 'external', processLiveness: 'alive' },
    title: 'Session started outside Threadbase',
    tier: 'observed',
  },
}

export const Conversation: Story = {
  render: () => (
    <BoardConversationCard
      title="Why does the relay drop the first frame?"
      conversation={{
        id: 'c1',
        serverId: 'server-1',
        title: 'tb-streamer',
        projectPath: '/Users/me/dev/ai-tools/tb-streamer',
        branch: 'main',
        messageCount: 12,
        lastActivity: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      }}
    />
  ),
}
