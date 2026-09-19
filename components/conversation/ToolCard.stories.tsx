import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { ToolCard } from './ToolCard'

const meta: Meta<typeof ToolCard> = {
  title: 'conversation/ToolCard',
  component: ToolCard,
  decorators: [(Story) => <View style={{ padding: 16 }}><Story /></View>],
}

export default meta
type Story = StoryObj<typeof ToolCard>

export const CodexExecCommand: Story = {
  args: {
    block: {
      type: 'tool_use',
      id: 'call_Xk2mP9qR4tV7wY1zB3dF6hJ8',
      name: 'exec_command',
      input: { cmd: 'npm run typecheck', workdir: '/Users/dev/tb-mobile' },
    },
  },
}

export const CodexResult: Story = {
  args: {
    block: {
      type: 'tool_result',
      toolUseId: 'call_Xk2mP9qR4tV7wY1zB3dF6hJ8',
      toolName: 'exec_command',
      content: '> threadbase-mobile@1.0.0 typecheck\n> tsc --noEmit\n',
    },
  },
}

export const CodexApplyPatch: Story = {
  args: {
    block: {
      type: 'tool_use',
      name: 'apply_patch',
      input: { input: '*** Begin Patch\n*** Update File: README.md\n@@\n-Old line\n+New line\n*** End Patch' },
    },
  },
}

export const CursorMcpCall: Story = {
  args: {
    block: {
      type: 'tool_use',
      id: 'cursor-tool-3e9a1c7f5b2d8046',
      name: 'CallMcpTool',
      input: { server: 'github', toolName: 'list_pull_requests', arguments: { state: 'open' } },
    },
  },
}
