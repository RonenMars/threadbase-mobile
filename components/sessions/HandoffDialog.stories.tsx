import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { fn } from 'storybook/test'
import { View } from 'react-native'
import { HandoffDialog } from './HandoffDialog'

const meta: Meta<typeof HandoffDialog> = {
  title: 'sessions/HandoffDialog',
  component: HandoffDialog,
  decorators: [(Story) => <View style={{ flex: 1 }}><Story /></View>],
  args: {
    visible: true,
    server: 'MacBook Pro',
    running: false,
    onConfirm: fn(),
    onDismiss: fn(),
  },
}

export default meta
type Story = StoryObj<typeof HandoffDialog>

export const Waiting: Story = {}
export const Running: Story = { args: { running: true } }
