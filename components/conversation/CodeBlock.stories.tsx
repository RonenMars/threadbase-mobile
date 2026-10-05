import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { CodeBlock } from './CodeBlock'

const meta: Meta<typeof CodeBlock> = {
  title: 'conversation/CodeBlock',
  component: CodeBlock,
  decorators: [(Story) => <View style={{ padding: 16 }}><Story /></View>],
}
export default meta

type Story = StoryObj<typeof CodeBlock>

export const Bash: Story = {
  args: { code: 'npm ci\nnpm run test:unit', language: 'bash' },
}

export const TypeScript: Story = {
  args: {
    code: 'export function add(a: number, b: number) {\n  return a + b\n}',
    language: 'tsx',
  },
}

export const Json: Story = {
  args: { code: '{\n  "name": "threadbase-mobile",\n  "private": true\n}', language: 'json' },
}

// `diff` skips Prism entirely for a hand-rolled line-prefix path.
export const Diff: Story = {
  args: { code: '- const a = 1\n+ const a = 2\n  const b = 3', language: 'diff' },
}

export const LongBlock: Story = {
  args: {
    code: Array.from({ length: 20 }, (_, i) => `console.log('line ${i + 1}')`).join('\n'),
    language: 'tsx',
  },
}
