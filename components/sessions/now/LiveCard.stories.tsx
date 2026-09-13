import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View, Text } from 'react-native'
import { LiveCard } from './LiveCard'

const meta: Meta<typeof LiveCard> = {
  title: 'sessions/now/LiveCard',
  component: LiveCard,
  decorators: [
    (Story) => (
      <View style={{ padding: 16 }}>
        <Story />
      </View>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof LiveCard>

export const Solid: Story = {
  args: {
    title: 'Why sessions open in terminal view after resume',
    color: '#d29922',
    emphasis: 'solid',
    onPress: () => {},
    accessibilityLabel: 'Session',
    children: <Text style={{ color: '#8b949e' }}>body</Text>,
  },
}

export const FaintWithServer: Story = {
  args: {
    title: 'Scan all worktrees, report which are stale',
    color: '#3fb950',
    emphasis: 'faint',
    serverLabel: 'studio-linux',
    serverColor: '#a371f7',
    onPress: () => {},
    accessibilityLabel: 'Session',
    children: <Text style={{ color: '#8b949e' }}>body</Text>,
  },
}
