import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { QuietTailRow } from './QuietTailRow'

const meta: Meta<typeof QuietTailRow> = {
  title: 'sessions/now/QuietTailRow',
  component: QuietTailRow,
  decorators: [
    (Story) => (
      <View style={{ padding: 16 }}>
        <Story />
      </View>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof QuietTailRow>

export const Ten: Story = {
  args: { count: 10, onPress: () => {} },
}
