import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { ConvRow } from './ConvRow'
import type { MultiConversation } from '@/types/api'

const conv: MultiConversation = {
  id: 'c1',
  serverId: 'server-1',
  title: 'Add the session board',
  projectPath: '/Users/me/dev/ai-tools/tb-mobile',
  messageCount: 24,
  lastActivity: new Date(Date.now() - 3_600_000).toISOString(),
}

const meta: Meta<typeof ConvRow> = {
  title: 'sessions/hub/ConvRow',
  component: ConvRow,
  decorators: [
    (Story) => (
      <View style={{ padding: 16 }}>
        <Story />
      </View>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof ConvRow>

export const Idle: Story = { args: { conv } }
export const RunningOutsideThreadbase: Story = {
  args: { conv: { ...conv, ownership: 'external', processLiveness: 'alive' } },
}
