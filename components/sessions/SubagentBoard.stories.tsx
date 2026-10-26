import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { SubagentBoard } from './SubagentBoard'

const meta: Meta<typeof SubagentBoard> = {
  title: 'sessions/SubagentBoard',
  component: SubagentBoard,
  decorators: [(Story) => <View style={{ height: 600 }}><Story /></View>],
}

export default meta
type Story = StoryObj<typeof SubagentBoard>

// No server answers in Storybook, so this shows the unsupported/empty path.
export const Default: Story = { args: { serverIds: ['story'], parentTitles: new Map() } }
