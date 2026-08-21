import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { fn } from 'storybook/test'
import { View } from 'react-native'
import { AlertDetailsModal } from './AlertDetailsModal'

const meta: Meta<typeof AlertDetailsModal> = {
  title: 'ui/AlertDetailsModal',
  component: AlertDetailsModal,
  decorators: [(Story) => <View style={{ minHeight: 420 }}><Story /></View>],
  args: {
    onClose: fn(),
  },
}

export default meta
type Story = StoryObj<typeof AlertDetailsModal>

export const Warning: Story = {
  args: {
    level: 'warning',
    title: '3 conversation histories are missing on Home Mac',
    message: 'Some conversation files on disk no longer match this server\'s cache.',
    details: '3 of the cached histories are missing. Review the list to prune, ignore, or rescan.',
  },
}

export const ErrorWithoutDetails: Story = {
  args: {
    level: 'error',
    title: "Can't reach Home Mac",
    message: 'This server did not respond. Sessions listed below may be incomplete until it comes back.',
  },
}
