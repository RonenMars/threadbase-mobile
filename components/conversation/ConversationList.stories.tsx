import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { ConversationList } from './ConversationList'
import type { MultiConversation } from '@/types/api'

const base: MultiConversation = {
  id: 'c1',
  serverId: 'server-1',
  title: 'Add the session board',
  projectPath: '/Users/me/dev/ai-tools/tb-mobile',
  messageCount: 24,
  lastActivity: new Date(Date.now() - 3_600_000).toISOString(),
}

const conversations: MultiConversation[] = [
  { ...base, id: 'c1', ownership: 'external', processLiveness: 'alive' },
  { ...base, id: 'c2', title: 'Fix the tree drill count', messageCount: 8 },
]

const meta: Meta<typeof ConversationList> = {
  title: 'conversation/ConversationList',
  component: ConversationList,
  decorators: [
    (Story) => (
      <View style={{ height: 600 }}>
        <Story />
      </View>
    ),
  ],
  args: {
    conversations,
    onRefresh: () => {},
    refreshing: false,
    onEndReached: () => {},
    searchQuery: '',
    onSearchChange: () => {},
  },
}

export default meta
type Story = StoryObj<typeof ConversationList>

export const WithLiveOutside: Story = {}
