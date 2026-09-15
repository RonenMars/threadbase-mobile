import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { ServerHeaderRow } from './ServerHeaderRow'

const meta: Meta<typeof ServerHeaderRow> = {
  title: 'sessions/ServerHeaderRow',
  component: ServerHeaderRow,
  decorators: [
    (Story) => (
      <View style={{ padding: 16 }}>
        <Story />
      </View>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof ServerHeaderRow>

export const Collapsible: Story = {
  args: { serverId: 'srv-1', serverLabel: 'studio-linux', totalCount: 6, collapsible: true, isExpanded: true, onToggle: () => {} },
}

export const Refreshing: Story = {
  args: { serverId: 'srv-1', serverLabel: 'MacBook Pro', totalCount: 319, isRefreshing: true },
}

export const Failed: Story = {
  args: {
    serverId: 'srv-1',
    serverLabel: 'studio-linux',
    totalCount: 6,
    collapsible: true,
    isExpanded: true,
    failed: true,
    onRetry: () => {},
    onDetails: () => {},
  },
}
