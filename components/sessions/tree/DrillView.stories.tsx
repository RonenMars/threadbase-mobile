import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DrillView } from './DrillView'
import type { TreeNode } from './types'

const node: TreeNode = {
  name: 'tb-mobile',
  fullPath: '/Users/me/dev/ai-tools/tb-mobile',
  projectPath: '/Users/me/dev/ai-tools/tb-mobile',
  children: new Map(),
  sessions: [],
  conversationCount: 12,
  liveExternalCount: 1,
  conversationActivityMs: Date.now() - 3_600_000,
  totalCount: 12,
  directCount: 12,
}

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

const meta: Meta<typeof DrillView> = {
  title: 'sessions/tree/DrillView',
  component: DrillView,
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <View style={{ height: 600 }}>
          <Story />
        </View>
      </QueryClientProvider>
    ),
  ],
  args: { node, serverId: 'server-1', onBack: () => {} },
}

export default meta
type Story = StoryObj<typeof DrillView>

export const LiveOutsideThreadbase: Story = {}
