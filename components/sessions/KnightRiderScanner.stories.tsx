import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { KnightRiderScanner } from './KnightRiderScanner'

const meta: Meta<typeof KnightRiderScanner> = {
  title: 'sessions/KnightRiderScanner',
  component: KnightRiderScanner,
  decorators: [
    (Story) => (
      <View style={{ padding: 16, alignItems: 'flex-start' }}>
        <Story />
      </View>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof KnightRiderScanner>

export const Compact: Story = {
  args: { size: 'compact' },
}

export const Banner: Story = {
  args: { size: 'banner' },
}
