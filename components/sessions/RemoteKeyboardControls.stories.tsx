import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { RemoteKeyboardControls } from './RemoteKeyboardControls'

const meta: Meta<typeof RemoteKeyboardControls> = {
  title: 'sessions/RemoteKeyboardControls',
  component: RemoteKeyboardControls,
  decorators: [(Story) => <View style={{ padding: 16 }}><Story /></View>],
  args: { onClose: () => {}, onSend: () => {} },
}

export default meta
type Story = StoryObj<typeof RemoteKeyboardControls>

export const PromptOpen: Story = {
  args: { promptId: 'prompt-1' },
}

export const EscapeOnly: Story = {
  args: {},
}
