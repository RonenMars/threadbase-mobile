import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { Badge } from './Badge'

const meta: Meta<typeof Badge> = {
  title: 'ui/Badge',
  component: Badge,
  decorators: [(Story) => <View style={{ padding: 16 }}><Story /></View>],
}

export default meta
type Story = StoryObj<typeof Badge>

export const Default: Story = {
  args: { label: 'idle' },
}

export const Medium: Story = {
  args: { label: 'running', size: 'md' },
}

export const Accent: Story = {
  args: { label: 'accent', color: '#58a6ff', bg: '#0d1117' },
}

export const Waiting: Story = {
  args: { label: 'waiting', color: '#d29922', bg: '#21262d' },
}

export const Failed: Story = {
  args: { label: 'failed', color: '#f85149', bg: '#21262d' },
}
