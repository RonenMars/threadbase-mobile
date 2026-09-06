import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { ExternalSessionBanner } from './ExternalSessionBanner'

const meta: Meta<typeof ExternalSessionBanner> = {
  title: 'sessions/ExternalSessionBanner',
  component: ExternalSessionBanner,
  decorators: [
    (Story) => (
      <View style={{ padding: 16 }}>
        <Story />
      </View>
    ),
  ],
  args: { onTakeOver: () => {} },
}

export default meta
type Story = StoryObj<typeof ExternalSessionBanner>

export const Default: Story = {}

/** While adopt is in flight: the action is a spinner and cannot be tapped twice. */
export const TakingOver: Story = {
  args: { isTakingOver: true },
}
