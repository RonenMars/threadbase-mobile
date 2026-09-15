import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { TerminalRawModeToast } from './TerminalRawModeToast'

const meta: Meta<typeof TerminalRawModeToast> = {
  title: 'terminal/TerminalRawModeToast',
  component: TerminalRawModeToast,
  decorators: [(Story) => <View style={{ flex: 1 }}><Story /></View>],
}

export default meta
type Story = StoryObj<typeof TerminalRawModeToast>

export const Visible: Story = {
  args: { visible: true },
}
