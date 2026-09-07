import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { NetworkError } from '@/services/api-client'
import { ModelEffortSheet } from './ModelEffortSheet'

const meta: Meta<typeof ModelEffortSheet> = {
  title: 'sessions/ModelEffortSheet',
  component: ModelEffortSheet,
  args: {
    visible: true,
    onApply: () => {},
    onClose: () => {},
  },
}

export default meta
type Story = StoryObj<typeof ModelEffortSheet>

export const Default: Story = {
  args: { model: 'Opus 4.8 (1M context)', effort: 'high' },
}

export const NoCurrentValues: Story = {
  args: {},
}

export const Busy: Story = {
  args: { model: 'Sonnet 4.8', effort: 'medium', busy: true },
}

export const Failed: Story = {
  args: {
    model: 'Sonnet 4.8',
    effort: 'medium',
    error: new NetworkError('Session is busy', 'SESSION_BUSY', undefined, 409),
  },
}
