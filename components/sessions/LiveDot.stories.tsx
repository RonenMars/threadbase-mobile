import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { LiveDot } from './LiveDot'

const meta: Meta<typeof LiveDot> = {
  title: 'sessions/LiveDot',
  component: LiveDot,
  decorators: [(Story) => <View style={{ padding: 16 }}><Story /></View>],
}

export default meta
type Story = StoryObj<typeof LiveDot>

export const Static: Story = {
  args: { live: false, color: '#3fb950' },
}

export const Pulsing: Story = {
  args: { live: true, color: '#3fb950' },
}
