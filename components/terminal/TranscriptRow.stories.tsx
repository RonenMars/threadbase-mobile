import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { TranscriptRow } from './TranscriptRow'
import type { Message } from '@/types/api'

function message(role: Message['role'], content: Message['content'], id = 'm1'): Message {
  return { id, uuid: id, role, content, timestamp: '2026-09-25T10:00:00.000Z' }
}

const meta: Meta<typeof TranscriptRow> = {
  title: 'terminal/TranscriptRow',
  component: TranscriptRow,
  decorators: [(Story) => <View style={{ padding: 16, backgroundColor: '#0d1117' }}><Story /></View>],
}
export default meta

type Story = StoryObj<typeof TranscriptRow>

export const UserPrompt: Story = {
  args: { message: message('user', [{ type: 'text', text: 'now run the tests' }]) },
}

export const PastedPrompt: Story = {
  args: {
    message: message('user', [
      { type: 'text', text: '<pasted_content id="1">\nline one\nline two\n</pasted_content id="1">' },
    ]),
  },
}

export const AssistantText: Story = {
  args: {
    message: message('assistant', [
      { type: 'text', text: 'All 6 pass (5 existing + the new one).\nConfirming the new test catches the bug.' },
    ]),
  },
}

export const ToolCall: Story = {
  args: {
    message: message('assistant', [
      { type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'npm test > /tmp/log 2>&1; echo "exit=$?"' } },
    ]),
  },
}

export const ToolResultFolded: Story = {
  args: {
    message: message('user', [
      {
        type: 'tool_result',
        toolUseId: 't1',
        toolName: 'Bash',
        content: Array.from({ length: 12 }, (_, i) => `PASS __tests__/unit/case-${i}.test.ts`).join('\n'),
      },
    ]),
  },
}

export const ToolResultError: Story = {
  args: {
    message: message('user', [
      { type: 'tool_result', toolUseId: 't1', toolName: 'Bash', content: 'exit=1\nnpm ERR! Test failed.', isError: true },
    ]),
  },
}

export const Thinking: Story = {
  args: {
    message: message('assistant', [
      { type: 'thinking', thinking: 'The failure is in the fixture, not the parser.\nChecking the fixture first.' },
    ]),
  },
}
