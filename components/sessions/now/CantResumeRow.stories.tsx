import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { CantResumeRow } from './CantResumeRow'

const meta: Meta<typeof CantResumeRow> = {
  title: 'sessions/now/CantResumeRow',
  component: CantResumeRow,
  decorators: [
    (Story) => (
      <View style={{ padding: 16 }}>
        <Story />
      </View>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof CantResumeRow>

export const WorktreeGone: Story = {
  args: {
    title: 'int-2026-09-12 · tb-streamer worktree',
    statusLabel: 'unavailableWorktree',
    timestamp: '2026-09-05T12:00:00.000Z',
  },
}

export const PathMissing: Story = {
  args: {
    title: 'old-scratch',
    statusLabel: 'unavailablePath',
    timestamp: '2026-09-01T12:00:00.000Z',
  },
}
