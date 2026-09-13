import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { ServerOfflineBanner } from './ServerOfflineBanner'

const meta: Meta<typeof ServerOfflineBanner> = {
  title: 'sessions/banners/ServerOfflineBanner',
  component: ServerOfflineBanner,
  decorators: [
    (Story) => (
      <View style={{ padding: 16 }}>
        <Story />
      </View>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof ServerOfflineBanner>

export const Default: Story = {
  args: { serverLabel: 'macbook-pro', onRetry: () => {} },
}
