import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { SubagentBoard, SubagentGroupCard } from './SubagentBoard'
import type { MultiConversation } from '@/types/api'

const meta: Meta<typeof SubagentBoard> = {
  title: 'sessions/SubagentBoard',
  component: SubagentBoard,
  decorators: [(Story) => <View style={{ height: 600 }}><Story /></View>],
}

export default meta
type Story = StoryObj<typeof SubagentBoard>

// No server answers in Storybook, so this shows the unsupported/empty path.
export const Default: Story = { args: { serverIds: ['story'], parentTitles: new Map() } }

const child = (id: string, over: Partial<MultiConversation> = {}): MultiConversation =>
  ({
    id,
    title: `Explore the auth flow, part ${id}`,
    serverId: 's1',
    projectPath: '/p',
    messageCount: 12,
    lastActivity: new Date(Date.now() - 90 * 60_000).toISOString(),
    provider: 'claude-code',
    isSubagent: true,
    subagentType: 'Explore',
    ...over,
  }) as MultiConversation

const groupArgs = (items: MultiConversation[]) => ({
  group: { parentId: 'p1', items, activeCount: items.filter((c) => c.subagentActive).length },
  title: 'Refactor the session list so a long parent title wraps onto two lines',
  isOpen: true,
  onToggle: () => {},
  onOpenParent: () => {},
  serverIdFor: () => 's1',
})

export const RunningGroup: Story = {
  render: () => <SubagentGroupCard {...groupArgs([child('a', { subagentActive: true }), child('b'), child('c'), child('d')])} />,
}

export const IdleGroup: Story = {
  render: () => <SubagentGroupCard {...groupArgs([child('a'), child('b')])} />,
}
