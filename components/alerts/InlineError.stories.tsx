import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { fn } from 'storybook/test'
import { View } from 'react-native'
import { InlineError } from './InlineError'

const meta: Meta<typeof InlineError> = {
  title: 'alerts/InlineError',
  component: InlineError,
  decorators: [(Story) => <View style={{ padding: 16 }}><Story /></View>],
}

export default meta
type Story = StoryObj<typeof InlineError>

export const LoadFailed: Story = {
  args: {
    title: "Couldn't load this conversation",
    message: 'The messages below did not arrive. Retry or go back to the list.',
    onRetry: fn(),
  },
}

export const WithDetails: Story = {
  args: {
    title: "Can't reach any of your servers. Sessions below may be stale.",
    message: 'Check the machines are awake and on the same network, then retry.',
    onRetry: fn(),
    onDetails: fn(),
    detailsLabel: 'Details',
  },
}
