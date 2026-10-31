import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProjectHubCard } from './ProjectHubCard'
import type { ProjectGroup } from './useProjectGroups'

const group: ProjectGroup = {
  projectId: '/Users/me/dev/ai-tools/tb-mobile',
  projectPath: '/Users/me/dev/ai-tools/tb-mobile',
  projectName: 'tb-mobile',
  serverId: 'server-1',
  sessions: [],
  conversationCount: 12,
  liveExternalCount: 0,
  latestActivityMs: Date.now() - 3_600_000,
  earliestStartMs: 0,
}

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

const meta: Meta<typeof ProjectHubCard> = {
  title: 'sessions/hub/ProjectHubCard',
  component: ProjectHubCard,
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <View style={{ padding: 16 }}>
          <Story />
        </View>
      </QueryClientProvider>
    ),
  ],
  args: { isOpen: false, onToggle: () => {} },
}

export default meta
type Story = StoryObj<typeof ProjectHubCard>

export const Quiet: Story = { args: { group } }
export const LiveOutsideThreadbase: Story = {
  args: { group: { ...group, liveExternalCount: 2 } },
}
