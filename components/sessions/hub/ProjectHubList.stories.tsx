import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProjectHubList } from './ProjectHubList'
import type { MultiProjectSummary } from '@/hooks/useProjectSummaries'

const summary: MultiProjectSummary = {
  serverId: 'server-1',
  path: '/Users/me/dev/ai-tools/tb-mobile',
  name: 'tb-mobile',
  conversationCount: 12,
  lastActivity: new Date(Date.now() - 3_600_000).toISOString(),
}

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

const meta: Meta<typeof ProjectHubList> = {
  title: 'sessions/hub/ProjectHubList',
  component: ProjectHubList,
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <View style={{ height: 700 }}>
          <Story />
        </View>
      </QueryClientProvider>
    ),
  ],
  args: {
    sessions: [],
    summaries: [
      { ...summary, liveExternalCount: 2 },
      { ...summary, path: '/Users/me/dev/ai-tools/tb-streamer', name: 'tb-streamer', conversationCount: 5 },
    ],
    sortBy: 'lastActivity',
    sortOrder: 'desc',
    refreshing: false,
    onRefresh: () => {},
    searchOpen: false,
    searchQuery: '',
  },
}

export default meta
type Story = StoryObj<typeof ProjectHubList>

export const LiveOutsideThreadbase: Story = {}
