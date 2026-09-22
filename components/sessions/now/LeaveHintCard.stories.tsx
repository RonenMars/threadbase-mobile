import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { fn } from 'storybook/test'
import { View } from 'react-native'
import { LeaveHintCard } from './LeaveHintCard'

const meta: Meta<typeof LeaveHintCard> = {
  title: 'sessions/now/LeaveHintCard',
  component: LeaveHintCard,
  decorators: [(Story) => <View style={{ padding: 16 }}><Story /></View>],
}

export default meta
type Story = StoryObj<typeof LeaveHintCard>

export const Default: Story = { args: { onDismiss: fn(), onOpenSettings: fn() } }
