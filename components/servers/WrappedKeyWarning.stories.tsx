import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { WrappedKeyWarning } from './WrappedKeyWarning'

const meta: Meta<typeof WrappedKeyWarning> = {
  title: 'servers/WrappedKeyWarning',
  component: WrappedKeyWarning,
  decorators: [
    (Story) => (
      <View style={{ padding: 16 }}>
        <Story />
      </View>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof WrappedKeyWarning>

export const Default: Story = {}
