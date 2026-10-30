import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { RecoveryOverlay } from './RecoveryOverlay'

const meta: Meta<typeof RecoveryOverlay> = {
  title: 'ui/RecoveryOverlay',
  component: RecoveryOverlay,
  decorators: [(Story) => <View style={{ minHeight: 320 }}><Story /></View>],
}

export default meta
type Story = StoryObj<typeof RecoveryOverlay>

export const Visible: Story = {
  args: { visible: true },
}
