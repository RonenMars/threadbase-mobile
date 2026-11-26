import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { Keyboard, Text, View } from 'react-native'
import { KeyboardDismissOverlay } from './KeyboardDismissOverlay'

const meta: Meta<typeof KeyboardDismissOverlay> = {
  title: 'ui/KeyboardDismissOverlay',
  component: KeyboardDismissOverlay,
}

export default meta
type Story = StoryObj<typeof KeyboardDismissOverlay>

export const KeyboardOpen: Story = {
  // The web build has no software keyboard, so the story forces the visible state.
  beforeEach: () => {
    const isVisible = Keyboard.isVisible
    Keyboard.isVisible = () => true
    return () => {
      Keyboard.isVisible = isVisible
    }
  },
  render: () => (
    <View style={{ height: 240, padding: 16 }}>
      <Text style={{ color: '#c9d1d9' }}>Search results stay readable under the overlay.</Text>
      <KeyboardDismissOverlay />
    </View>
  ),
}
