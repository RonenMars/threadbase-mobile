import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { fn } from 'storybook/test'
import { View } from 'react-native'
import { LeaveSessionModal } from './LeaveSessionModal'

const meta: Meta<typeof LeaveSessionModal> = {
  title: 'sessions/LeaveSessionModal',
  component: LeaveSessionModal,
  decorators: [(Story) => <View style={{ flex: 1 }}><Story /></View>],
  args: {
    visible: true,
    phase: 'idle',
    agent: 'Claude',
    server: 'MacBook Pro',
    offerWhenDone: true,
    onCancel: fn(),
    onConfirm: fn(),
    onDismissError: fn(),
    onModalDismiss: fn(),
  },
}

export default meta
type Story = StoryObj<typeof LeaveSessionModal>

export const Working: Story = {}
export const Waiting: Story = { args: { waiting: true, offerWhenDone: false } }
export const Pending: Story = { args: { phase: 'pending' } }
export const Failed: Story = { args: { phase: 'error' } }
