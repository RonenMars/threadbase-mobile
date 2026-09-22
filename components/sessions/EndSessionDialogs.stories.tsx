import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { fn } from 'storybook/test'
import { View } from 'react-native'
import { EndSessionDialogs } from './EndSessionDialogs'

const meta: Meta<typeof EndSessionDialogs> = {
  title: 'sessions/EndSessionDialogs',
  component: EndSessionDialogs,
  decorators: [(Story) => <View style={{ flex: 1 }}><Story /></View>],
  args: {
    server: 'MacBook Pro',
    onConfirmDelete: fn(),
    onConfirmWatchers: fn(),
    onDismiss: fn(),
  },
}

export default meta
type Story = StoryObj<typeof EndSessionDialogs>

export const DeleteClaude: Story = { args: { dialog: 'delete', provider: 'claude-code' } }
export const DeleteCodex: Story = { args: { dialog: 'delete', provider: 'codex-cli' } }
export const DeleteCursor: Story = { args: { dialog: 'delete', provider: 'cursor' } }
export const Watchers: Story = { args: { dialog: 'watchers', provider: 'claude-code' } }
