import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { NeedsYouCard } from './NeedsYouCard'
import type { MultiSession } from '@/types/api'

const session: MultiSession = {
  id: 's1',
  serverId: 'server-1',
  serverLabel: 'MacBook Pro',
  status: 'waiting_input',
  ptyAttached: true,
  lifecycle: 'attached',
  subStatus: null,
  statusUpdatedAt: new Date(Date.now() - 2 * 60_000).toISOString(),
  projectPath: '/Users/me/dev/ai-tools/tb-mobile',
  projectName: 'tb-mobile',
  branch: 'main',
  lastOutput: 'Do you want to proceed? 1. Yes 2. No',
  elapsedMs: 22 * 60_000,
  promptCount: 2,
  startedAt: new Date(Date.now() - 22 * 60_000).toISOString(),
}

const meta: Meta<typeof NeedsYouCard> = {
  title: 'sessions/now/NeedsYouCard',
  component: NeedsYouCard,
  decorators: [
    (Story) => (
      <View style={{ padding: 16 }}>
        <Story />
      </View>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof NeedsYouCard>

export const Default: Story = {
  args: { session, title: 'Why sessions open in terminal view after resume' },
}

export const MultiServer: Story = {
  args: {
    session,
    title: 'Why sessions open in terminal view after resume',
    serverLabel: 'MacBook Pro',
    serverColor: '#58a6ff',
  },
}
