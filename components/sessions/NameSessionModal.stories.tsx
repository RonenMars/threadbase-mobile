import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { fn } from 'storybook/test'
import { View } from 'react-native'
import { NameSessionModal } from './NameSessionModal'

const meta: Meta<typeof NameSessionModal> = {
  title: 'sessions/NameSessionModal',
  component: NameSessionModal,
  decorators: [(Story) => <View style={{ flex: 1 }}><Story /></View>],
  args: { visible: true, onSave: fn(), onCancel: fn() },
}

export default meta
type Story = StoryObj<typeof NameSessionModal>

export const Create: Story = { args: { mode: 'create' } }

export const Rename: Story = { args: { mode: 'rename', currentName: 'Fix login redirect' } }
