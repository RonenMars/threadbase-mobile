import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { ProviderMark } from './ProviderMark'

const meta: Meta<typeof ProviderMark> = {
  title: 'sessions/ProviderMark',
  component: ProviderMark,
  decorators: [
    (Story) => (
      <View style={{ padding: 16 }}>
        <Story />
      </View>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof ProviderMark>

export const Claude: Story = {
  args: { provider: 'claude-code' },
}

export const Codex: Story = {
  args: { provider: 'codex-cli' },
}

export const Cursor: Story = {
  args: { provider: 'cursor-cli' },
}
