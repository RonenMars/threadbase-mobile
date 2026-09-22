import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { fn } from 'storybook/test'
import { View } from 'react-native'
import { LeaveNotice } from './LeaveNotice'

const meta: Meta<typeof LeaveNotice> = {
  title: 'sessions/LeaveNotice',
  component: LeaveNotice,
  decorators: [(Story) => <View style={{ flex: 1 }}><Story /></View>],
  args: {
    visible: true,
    phase: 'idle',
    agent: 'Claude',
    server: 'MacBook Pro',
    waiting: false,
    onLeave: fn(),
    onModalDismiss: fn(),
  },
}

export default meta
type Story = StoryObj<typeof LeaveNotice>

export const Working: Story = {}
export const Waiting: Story = { args: { waiting: true } }
