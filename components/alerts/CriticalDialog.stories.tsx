import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { fn } from 'storybook/test'
import { View } from 'react-native'
import { CriticalDialog } from './CriticalDialog'

const meta: Meta<typeof CriticalDialog> = {
  title: 'alerts/CriticalDialog',
  component: CriticalDialog,
  decorators: [(Story) => <View style={{ flex: 1 }}><Story /></View>],
}

export default meta
type Story = StoryObj<typeof CriticalDialog>

export const LeaveSession: Story = {
  args: {
    visible: true,
    level: 'warning',
    title: "Leave while it's working?",
    message: 'Claude keeps going on MacBook Pro unless you end it.',
    onRequestClose: fn(),
    stacked: true,
    actions: [
      { label: 'Keep running', onPress: fn() },
      { label: 'Terminate when done', variant: 'secondary', onPress: fn() },
      { label: 'Terminate', variant: 'destructive', onPress: fn() },
      { label: 'Stay here', variant: 'secondary', onPress: fn() },
    ],
  },
}

export const ResumeCollision: Story = {
  args: {
    visible: true,
    title: 'Resume this conversation?',
    message: 'This conversation may still be open in a terminal on your computer. Resuming it here could interfere with that session.',
    onRequestClose: fn(),
    actions: [
      { label: 'Cancel', variant: 'secondary', onPress: fn() },
      { label: 'Take over', variant: 'destructive', onPress: fn() },
      { label: 'Resume anyway', onPress: fn() },
    ],
  },
}

export const SessionExpired: Story = {
  args: {
    visible: true,
    title: 'Your session has expired',
    message: 'Open Settings to pair this device again or update the API key.',
    onRequestClose: fn(),
    actions: [
      { label: 'Close', variant: 'secondary', onPress: fn() },
      { label: 'Open Settings', onPress: fn() },
    ],
  },
}
