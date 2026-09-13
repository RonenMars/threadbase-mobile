import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { QuietRow } from './QuietRow'

const meta: Meta<typeof QuietRow> = {
  title: 'sessions/now/QuietRow',
  component: QuietRow,
  decorators: [
    (Story) => (
      <View style={{ padding: 16 }}>
        <Story />
      </View>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof QuietRow>

const timestamp = new Date(Date.now() - 20 * 60_000).toISOString()

export const Command: Story = {
  args: { label: 'git pull', meta: 'tb-mobile · main', timestamp },
}

export const Identity: Story = {
  args: { label: 'state-tiers · main', timestamp },
}

export const Undimmed: Story = {
  args: { label: 'git pull', meta: 'tb-mobile · main', timestamp, dimmed: false },
}
