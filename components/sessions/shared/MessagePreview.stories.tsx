import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { MessagePreview } from './MessagePreview'

const meta: Meta<typeof MessagePreview> = {
  title: 'sessions/MessagePreview',
  component: MessagePreview,
}

export default meta
type Story = StoryObj<typeof MessagePreview>

export const FirstMessage: Story = {
  args: { firstMessage: { text: 'Rebase the checkout branch onto main' }, messageCount: 2 },
}

export const TerminalFallback: Story = {
  args: { lastOutput: '\x1b[31mzsh: command not found\x1b[0m\x1b[?25l' },
}
