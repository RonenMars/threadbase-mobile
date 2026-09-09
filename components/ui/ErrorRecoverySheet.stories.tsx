import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { fn } from 'storybook/test'
import { ErrorRecoverySheet } from './ErrorRecoverySheet'

const meta: Meta<typeof ErrorRecoverySheet> = {
  title: 'ui/ErrorRecoverySheet',
  component: ErrorRecoverySheet,
  args: {
    visible: true,
    title: 'Some requests failed',
    items: [
      {
        id: 'messages',
        title: 'Messages failed to load',
        message: 'The server did not respond. Try again when it is reachable.',
      },
    ],
    onClose: fn(),
  },
}

export default meta
type Story = StoryObj<typeof ErrorRecoverySheet>

export const Default: Story = {}

export const WithRetry: Story = {
  args: {
    retryAllLabel: 'Retry all',
    onRetryAll: fn(),
  },
}
