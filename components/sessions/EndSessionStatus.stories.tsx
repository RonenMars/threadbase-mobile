import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { fn } from 'storybook/test'
import { View } from 'react-native'
import { EndSessionStatus } from './EndSessionStatus'

const meta: Meta<typeof EndSessionStatus> = {
  title: 'sessions/EndSessionStatus',
  component: EndSessionStatus,
  decorators: [(Story) => <View style={{ padding: 16 }}><Story /></View>],
}

export default meta
type Story = StoryObj<typeof EndSessionStatus>

export const Armed: Story = { args: { armed: true } }
export const Terminating: Story = { args: { armed: false, terminatingAt: Date.now(), onForce: fn() } }
export const StillRunning: Story = { args: { armed: false, terminatingAt: Date.now() - 9000, onForce: fn() } }
export const StillRunningOldServer: Story = { args: { armed: false, terminatingAt: Date.now() - 9000 } }
