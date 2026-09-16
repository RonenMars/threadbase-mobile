import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { fn } from 'storybook/test'
import { View } from 'react-native'
import { StatusStrip } from './StatusStrip'

const meta: Meta<typeof StatusStrip> = {
  title: 'alerts/StatusStrip',
  component: StatusStrip,
  args: { onPress: fn() },
  decorators: [(Story) => <View style={{ minHeight: 80 }}><Story /></View>],
}

export default meta
type Story = StoryObj<typeof StatusStrip>

export const NewError: Story = {
  args: {
    title: "Can't reach Ronens-MacBook-Pro. Your sessions below are from 6 minutes ago.",
  },
}
