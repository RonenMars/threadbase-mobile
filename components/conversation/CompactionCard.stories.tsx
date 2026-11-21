import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import type { Message } from '@/types/api'
import { CompactionCard } from './CompactionCard'

const meta: Meta<typeof CompactionCard> = {
  title: 'conversation/CompactionCard',
  component: CompactionCard,
}

export default meta
type Story = StoryObj<typeof CompactionCard>

const message = (compaction: Message['compaction']): Message => ({
  id: 'c-1',
  role: 'user',
  timestamp: '2026-11-20T13:00:07.952Z',
  is_compact_summary: true,
  compaction,
  content: [{
    type: 'text',
    text: 'This session is being continued from a previous conversation that ran out of context.\n\nSummary:\n1. **Primary Request and Intent:**\n   - Add `questionOther` support to the QuestionCard.',
  }],
})

export const Auto: Story = {
  args: { message: message({ trigger: 'auto', preTokens: 266778, postTokens: 28645 }) },
}

export const NoStats: Story = {
  args: { message: message(null) },
}
