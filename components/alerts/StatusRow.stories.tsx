import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { fn } from 'storybook/test'
import { View } from 'react-native'
import { StatusRow } from './StatusRow'
import type { AlertEntry } from '@/types/alerts'

const errorEntry: AlertEntry = {
  id: 's0',
  viewport: 'global',
  cause: 'server:s0',
  raisedAt: 0,
  level: 'error',
  title: 'Ronens-MacBook-Pro',
  message: 'Nothing has loaded from this server. Sessions below may be stale.',
  code: 'HTTP_503',
  rawMessage: 'connect ECONNREFUSED',
  retryable: true,
  buttonText: 'Retry',
  buttonAction: fn(),
  timeout: null,
}

const meta: Meta<typeof StatusRow> = {
  title: 'alerts/StatusRow',
  component: StatusRow,
  decorators: [(Story) => <View style={{ padding: 16 }}><Story /></View>],
}

export default meta
type Story = StoryObj<typeof StatusRow>

export const ErrorWithRetry: Story = {
  args: { entry: errorEntry },
}

export const Warning: Story = {
  args: {
    entry: {
      id: 'hp',
      viewport: 'home',
      cause: 'host-pressure:s0',
      raisedAt: 0,
      level: 'warning',
      title: 'Host under load',
      message: 'New sessions may be slow until something is closed on the computer.',
      timeout: null,
    },
  },
}

export const NotRetryable: Story = {
  args: {
    entry: {
      id: 'messages',
      viewport: 'global',
      cause: 'query:messages',
      raisedAt: 0,
      level: 'error',
      title: 'Messages failed to load',
      message: 'This could no longer be found',
      code: 'HTTP_404',
      rawMessage: 'not found',
      retryable: false,
      timeout: null,
    },
  },
}
