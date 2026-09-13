import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { ServerUnsupportedBanner } from './ServerUnsupportedBanner'

const meta: Meta<typeof ServerUnsupportedBanner> = {
  title: 'sessions/banners/ServerUnsupportedBanner',
  component: ServerUnsupportedBanner,
  decorators: [
    (Story) => (
      <View style={{ padding: 16 }}>
        <Story />
      </View>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof ServerUnsupportedBanner>

export const Default: Story = {
  args: { serverLabel: 'macbook-pro' },
}
