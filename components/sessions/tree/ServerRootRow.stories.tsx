import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { ServerRootRow } from './ServerRootRow'
import type { TreeNode } from './types'

const node: TreeNode = {
  name: 'workspace',
  fullPath: '/workspace',
  children: new Map(),
  sessions: [],
  conversationCount: 12,
  conversationActivityMs: Date.now(),
  totalCount: 12,
  directCount: 0,
}

const meta: Meta<typeof ServerRootRow> = {
  title: 'sessions/tree/ServerRootRow',
  component: ServerRootRow,
  decorators: [
    (Story) => (
      <View style={{ padding: 16 }}>
        <Story />
      </View>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof ServerRootRow>

export const SingleServer: Story = {
  args: { node, serverLabel: 'Laptop', collapsible: false, isExpanded: true, onToggle: () => {}, onSelectLeaf: () => {} },
}

export const MultiServerCollapsible: Story = {
  args: { node, serverLabel: 'Laptop', collapsible: true, isExpanded: false, onToggle: () => {}, onSelectLeaf: () => {} },
}
