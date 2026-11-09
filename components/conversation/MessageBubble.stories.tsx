import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { MessageBubble } from './MessageBubble'
import type { Message } from '@/types/api'

function message(role: Message['role'], content: Message['content'], id = 'm1'): Message {
  return { id, uuid: id, role, content, timestamp: '2026-10-04T10:00:00.000Z' }
}

const meta: Meta<typeof MessageBubble> = {
  title: 'conversation/MessageBubble',
  component: MessageBubble,
  decorators: [(Story) => <View style={{ paddingVertical: 16 }}><Story /></View>],
}
export default meta

type Story = StoryObj<typeof MessageBubble>

export const UserMessage: Story = {
  args: { message: message('user', [{ type: 'text', text: 'now run the tests' }]) },
}

export const Queued: Story = {
  args: { message: message('user', [{ type: 'text', text: 'Also rename the helper while you are in there.' }]), queued: true },
}

export const AssistantMessage: Story = {
  args: {
    message: message('assistant', [
      { type: 'text', text: 'All 6 pass (5 existing + the new one).' },
    ]),
  },
}

export const MarkdownProse: Story = {
  args: {
    message: message('assistant', [
      { type: 'text', text: '## Summary\n\n- **one**\n- *two*\n\nSee `lib/markdown/`.' },
    ]),
  },
}

export const FencedCode: Story = {
  args: {
    message: message('assistant', [
      { type: 'text', text: 'Run:\n\n```bash\nnpm ci\nnpm run test:unit\n```\n\nThen push.' },
    ]),
  },
}

export const BareFenceGuessesLanguage: Story = {
  args: {
    message: message('assistant', [
      { type: 'text', text: '```\nexport function add(a: number, b: number) {\n  return a + b\n}\n```' },
    ]),
  },
}

export const DiffFence: Story = {
  args: {
    message: message('assistant', [
      { type: 'text', text: '```diff\n- const a = 1\n+ const a = 2\n```' },
    ]),
  },
}

export const WithSearchHighlight: Story = {
  args: {
    message: message('assistant', [
      { type: 'text', text: 'The parser lives in lib/markdown and the renderer beside it.' },
    ]),
    highlight: 'parser',
    activeMatch: true,
  },
}

export const WithTokenCount: Story = {
  args: {
    message: { ...message('assistant', [{ type: 'text', text: 'Done.' }]), tokens: 1420 },
  },
}
