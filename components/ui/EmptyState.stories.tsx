import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { EmptyState } from './EmptyState'

const meta: Meta<typeof EmptyState> = {
  title: 'ui/EmptyState',
  component: EmptyState,
  decorators: [(Story) => <View style={{ minHeight: 320 }}><Story /></View>],
}

export default meta
type Story = StoryObj<typeof EmptyState>

export const TitleOnly: Story = {
  args: { title: 'No sessions yet' },
}

export const WithSubtitle: Story = {
  args: {
    title: 'No sessions yet',
    subtitle: 'Start a session on a connected server to see it here.',
  },
}

export const WithAction: Story = {
  args: {
    title: 'No sessions',
    subtitle: 'Start a Claude Code or Codex session to see it here',
    action: { label: 'New session', onPress: () => {}, plus: true },
  },
}
