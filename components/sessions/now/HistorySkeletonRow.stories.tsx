import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { HistorySkeletonRow } from './HistorySkeletonRow'

const meta: Meta<typeof HistorySkeletonRow> = {
  title: 'sessions/now/HistorySkeletonRow',
  component: HistorySkeletonRow,
  decorators: [
    (Story) => (
      <View style={{ padding: 16, gap: 8 }}>
        <Story />
        <HistorySkeletonRow />
      </View>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof HistorySkeletonRow>

export const Pair: Story = {}
