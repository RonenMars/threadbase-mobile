import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { DrillFolderRow } from './DrillFolderRow'

const meta: Meta<typeof DrillFolderRow> = {
  title: 'sessions/tree/DrillFolderRow',
  component: DrillFolderRow,
  decorators: [
    (Story) => (
      <View style={{ padding: 16 }}>
        <Story />
      </View>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof DrillFolderRow>

export const Idle: Story = {
  args: {
    name: 'tb-streamer',
    count: 12,
    timestampMs: Date.now() - 3_600_000,
    dotColor: '#30363d',
    onPress: () => {},
  },
}

export const Live: Story = {
  args: {
    name: 'tb-mobile',
    count: 46,
    timestampMs: Date.now(),
    dotColor: '#d29922',
    live: true,
    onPress: () => {},
  },
}
