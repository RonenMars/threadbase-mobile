import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { QuestionCard } from './QuestionCard'
import type { QuestionBlock } from '@/utils/parseQuestionBlock'

const structured: QuestionBlock = {
  source: 'structured',
  toolUseId: 't1',
  questions: [{
    question: 'Add fallback to ConversationCache?',
    header: 'Fallback',
    multiSelect: false,
    options: [
      { label: 'both (Recommended)', description: 'indicator and discriminator' },
      { label: 'indicator only' },
      { label: 'discriminator only' },
      { label: 'Nothing.' },
    ],
  }],
}

const permission: QuestionBlock = {
  source: 'permission',
  permissionIndices: [1, 2, 3],
  questions: [{
    question: 'Do you want to proceed?',
    detail: 'Bash command\ngit worktree add ../tb-mobile-worktrees/prune-loader\nThis command requires approval',
    multiSelect: false,
    options: [
      { label: 'Yes' },
      { label: 'Yes, and don’t ask again for: git worktree *' },
      { label: 'No' },
    ],
  }],
}

const meta: Meta<typeof QuestionCard> = {
  title: 'terminal/QuestionCard',
  component: QuestionCard,
  decorators: [(Story) => <View style={{ padding: 16 }}><Story /></View>],
  args: { onSelect: () => {} },
}

export default meta
type Story = StoryObj<typeof QuestionCard>

export const Structured: Story = {
  args: { block: structured },
}

// The permission gate: a `detail` block above the question, and a Cancel that
// sends Esc rather than an answer.
export const PermissionGate: Story = {
  args: { block: permission, onCancel: () => {} },
}

// The PTY scrape carries the terminal's ❯ cursor row, so this source is the one
// that renders pre-selected.
export const PtyCursorSelected: Story = {
  args: {
    block: { ...structured, source: 'pty', toolUseId: undefined, selectedIndex: 2 },
  },
}

// The window between the tap and the server taking the answer. The rows lock so
// a double-tap cannot send twice; nothing else about the card changes yet.
export const AnswerInFlight: Story = {
  args: { block: permission, busy: true, onCancel: () => {} },
}

// Answered, but the gate has not been seen closing. The card stays up so the
// user can see what they chose, dimmed and inert — it blocks nothing, which is
// what makes an unconfirmed answer cost them nothing. Cancel is gone: there is
// nothing left to cancel.
export const Ghost: Story = {
  args: { block: permission, ghost: true, onCancel: () => {} },
}
