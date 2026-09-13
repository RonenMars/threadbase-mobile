import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { WorkingCard } from './WorkingCard'
import type { MultiSession } from '@/types/api'

const session: MultiSession = {
  id: 's2',
  serverId: 'server-1',
  serverLabel: 'MacBook Pro',
  status: 'running',
  ptyAttached: true,
  lifecycle: 'attached',
  subStatus: 'streaming',
  projectPath: '/Users/me/dev/ai-tools/tb-streamer',
  projectName: 'tb-streamer',
  branch: 'main',
  lastOutput: '',
  elapsedMs: 4 * 60_000,
  promptCount: 3,
  startedAt: new Date(Date.now() - 4 * 60_000).toISOString(),
}

const meta: Meta<typeof WorkingCard> = {
  title: 'sessions/now/WorkingCard',
  component: WorkingCard,
  decorators: [
    (Story) => (
      <View style={{ padding: 16 }}>
        <Story />
      </View>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof WorkingCard>

export const Replying: Story = {
  args: { session, title: 'Merge all green dependabot PRs, rebase between each' },
}

export const NoPhase: Story = {
  args: { session: { ...session, subStatus: null, elapsedMs: 18_000 }, title: 'Scan all worktrees, report which are stale' },
}
