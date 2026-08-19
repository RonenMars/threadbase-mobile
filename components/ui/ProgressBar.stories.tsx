import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { ProgressBar } from './ProgressBar'

const meta: Meta<typeof ProgressBar> = {
  title: 'ui/ProgressBar',
  component: ProgressBar,
  decorators: [(Story) => <View style={{ padding: 16 }}><Story /></View>],
}

export default meta
type Story = StoryObj<typeof ProgressBar>

export const Empty: Story = {
  args: { loaded: 0, total: 10 },
}

export const Partial: Story = {
  args: { loaded: 4, total: 10 },
}

export const Complete: Story = {
  args: { loaded: 10, total: 10 },
}
