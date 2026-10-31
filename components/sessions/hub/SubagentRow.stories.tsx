import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { SubagentRow } from './SubagentRow'
import type { MultiConversation } from '@/types/api'

const conv = {
  id: 'c1',
  title: 'Explore auth flow',
  serverId: 's1',
  projectPath: '/p',
  messageCount: 4,
  lastActivity: '2026-10-24T10:00:00Z',
  provider: 'claude-code',
  isSubagent: true,
  subagentType: 'Explore',
  subagentActive: true,
} as MultiConversation

const meta: Meta<typeof SubagentRow> = { title: 'Sessions/SubagentRow', component: SubagentRow }
export default meta
type Story = StoryObj<typeof SubagentRow>

export const Active: Story = { args: { conv } }
export const Idle: Story = { args: { conv: { ...conv, subagentActive: false } } }
