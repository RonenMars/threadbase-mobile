import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { StateBadge } from './StateBadge'

const meta: Meta<typeof StateBadge> = {
  title: 'sessions/StateBadge',
  component: StateBadge,
  decorators: [
    (Story) => (
      <View style={{ padding: 16 }}>
        <Story />
      </View>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof StateBadge>

export const NeedsYou: Story = {
  args: { tier: 'needsYou', qualifier: 'waiting 2m' },
}

export const Working: Story = {
  args: { tier: 'working' },
}

export const Resumable: Story = {
  args: { tier: 'resumable' },
}

export const CantResume: Story = {
  args: { tier: 'cantResume' },
}

export const Observed: Story = {
  args: { tier: 'observed' },
}
