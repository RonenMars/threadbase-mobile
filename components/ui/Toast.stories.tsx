import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { fn } from 'storybook/test'
import { View } from 'react-native'
import { Toast } from './Toast'

const meta: Meta<typeof Toast> = {
  title: 'ui/Toast',
  component: Toast,
  decorators: [(Story) => <View style={{ minHeight: 120 }}><Story /></View>],
  args: {
    onOpenDetails: fn(),
    onDismiss: fn(),
  },
}

export default meta
type Story = StoryObj<typeof Toast>

export const Info: Story = {
  args: {
    toast: {
      id: 'info',
      viewport: 'root',
      level: 'info',
      title: 'Connecting to Home Mac…',
      message: 'Establishing a connection to the server.',
    },
  },
}

export const WarningWithAction: Story = {
  args: {
    toast: {
      id: 'cache-alert',
      viewport: 'root',
      level: 'warning',
      title: '3 conversation histories are missing on Home Mac',
      message: 'Some conversation files on disk no longer match this server\'s cache.',
      details: '3 of the cached histories are missing.',
      buttonText: 'Review',
      buttonAction: fn(),
      hideCloseButton: true,
    },
  },
}

export const Error: Story = {
  args: {
    toast: {
      id: 'server-state',
      viewport: 'root',
      level: 'error',
      title: "Can't reach Home Mac. Check your connection or server address.",
      message: 'This server did not respond.',
      details: 'Sessions listed below may be incomplete until it comes back.',
      buttonText: 'Details',
      buttonAction: fn(),
    },
  },
}
