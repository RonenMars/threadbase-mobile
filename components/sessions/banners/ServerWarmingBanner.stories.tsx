import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { ServerWarmingBanner } from './ServerWarmingBanner'

const meta: Meta<typeof ServerWarmingBanner> = {
  title: 'sessions/banners/ServerWarmingBanner',
  component: ServerWarmingBanner,
  decorators: [
    (Story) => (
      <View style={{ padding: 16 }}>
        <Story />
      </View>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof ServerWarmingBanner>

export const Default: Story = {
  args: { serverLabel: 'macbook-pro' },
}
