import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { LiveSessionsHeader } from './LiveSessionsHeader'

const meta: Meta<typeof LiveSessionsHeader> = {
  title: 'sessions/LiveSessionsHeader',
  component: LiveSessionsHeader,
  decorators: [
    (Story) => (
      <View style={{ padding: 16 }}>
        <Story />
      </View>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof LiveSessionsHeader>

export const Fixed: Story = {
  args: { count: 1, hasLive: true },
}

export const Collapsible: Story = {
  args: { count: 4, hasLive: true, collapsed: false, onToggle: () => {} },
}
