import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { EarlierRow } from './EarlierRow'
import type { MultiConversation, MultiSession } from '@/types/api'

const held: MultiSession = {
  id: 's3',
  serverId: 'server-1',
  status: 'idle',
  ptyAttached: false,
  lifecycle: 'resumable',
  subStatus: null,
  projectPath: '/Users/me/dev/ai-tools/tb-mobile',
  projectName: 'tb-mobile',
  branch: 'main',
  lastOutput: '',
  elapsedMs: 0,
  promptCount: 12,
  startedAt: new Date(Date.now() - 3 * 3600_000).toISOString(),
}

const gone: MultiConversation = {
  id: 'c9',
  serverId: 'server-1',
  title: 'int-2026-09-12 · tb-streamer worktree',
  projectPath: '/Users/me/dev/ai-tools/tb-mobile-worktrees/int-2026-09-12',
  messageCount: 4,
  lastActivity: new Date(Date.now() - 8 * 86_400_000).toISOString(),
}

const meta: Meta<typeof EarlierRow> = {
  title: 'sessions/now/EarlierRow',
  component: EarlierRow,
  decorators: [
    (Story) => (
      <View style={{ padding: 16 }}>
        <Story />
      </View>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof EarlierRow>

export const Resumable: Story = {
  args: { item: { kind: 'session', ms: 0, item: held }, title: 'Report slow streamer requests from release builds' },
}

export const OlderConversation: Story = {
  args: { item: { kind: 'conversation', ms: 0, item: gone }, title: 'int-2026-09-12 · tb-streamer worktree' },
}
