import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { fn } from 'storybook/test'
import { View } from 'react-native'
import { StatusPill } from './StatusPill'

const meta: Meta<typeof StatusPill> = {
  title: 'alerts/StatusPill',
  component: StatusPill,
  args: { onPress: fn() },
  decorators: [(Story) => <View style={{ padding: 16, alignItems: 'flex-start' }}><Story /></View>],
}

export default meta
type Story = StoryObj<typeof StatusPill>

export const OneIssue: Story = {
  args: { surface: 'error', issueCount: 1 },
}

export const SeveralIssues: Story = {
  args: { surface: 'error', issueCount: 3 },
}

export const Degraded: Story = {
  args: { surface: 'warning', issueCount: 0 },
}
