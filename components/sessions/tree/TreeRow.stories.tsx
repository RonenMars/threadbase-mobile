import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { TreeRow } from './TreeRow'
import type { TreeNode } from './types'

const node: TreeNode = {
  name: 'storefront',
  fullPath: '/workspace/northstar-commerce/apps/storefront',
  children: new Map(),
  sessions: [],
  conversationCount: 4,
  conversationActivityMs: Date.now(),
  totalCount: 4,
  directCount: 4,
}

const meta: Meta<typeof TreeRow> = {
  title: 'sessions/tree/TreeRow',
  component: TreeRow,
  decorators: [
    (Story) => (
      <View style={{ padding: 16 }}>
        <Story />
      </View>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof TreeRow>

export const Leaf: Story = {
  args: { node, depth: 1, depthOffset: 0, isExpanded: false, onToggle: () => {}, onSelectLeaf: () => {} },
}

export const Expanded: Story = {
  args: {
    node: { ...node, children: new Map([[node.fullPath, node]]), totalCount: 8 },
    depth: 0,
    depthOffset: 0,
    isExpanded: true,
    onToggle: () => {},
    onSelectLeaf: () => {},
  },
}
