import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { MarkdownTable } from './MarkdownTable'
import { parseBlocks } from '@/lib/markdown'

// Parsed through the real parser so a story can never drift from what a
// message actually produces; cells draw as plain text here — the chat renderer
// supplies styled spans (see the ChatMarkdown stories).
function tableArgs(source: string) {
  const [block] = parseBlocks(source)
  if (block.kind !== 'table') throw new Error('story source is not a table')
  return {
    align: block.align,
    header: block.header,
    rows: block.rows,
    renderSpans: (spans: Parameters<typeof MarkdownTable>[0]['header'][number]) => spans.map((s) => s.text).join(''),
  }
}

const meta: Meta<typeof MarkdownTable> = {
  title: 'conversation/MarkdownTable',
  component: MarkdownTable,
  decorators: [(Story) => <View style={{ padding: 16, maxWidth: 360 }}><Story /></View>],
}
export default meta

type Story = StoryObj<typeof MarkdownTable>

export const Basic: Story = {
  args: tableArgs('| Tool | Purpose |\n|---|---|\n| jest | unit tests |\n| maestro | e2e flows |'),
}

export const Aligned: Story = {
  args: tableArgs('| Item | Qty | Price |\n|:--|:-:|--:|\n| apples | 3 | 1.20 |\n| pears | 12 | 14.40 |'),
}

// Wider than the 360pt frame: the grid scrolls sideways instead of squeezing.
export const WideScrolls: Story = {
  args: tableArgs(
    '| File | Lines | Owner | Last change | Notes |\n|---|---|---|---|---|\n| lib/markdown/blocks.ts | 190 | parser | 2026-11-22 | adds the table rule |\n| components/conversation/ChatMarkdown.tsx | 360 | chat | 2026-11-22 | draws the grid |',
  ),
}

// A long cell wraps inside its capped column rather than widening the grid.
export const LongCellWraps: Story = {
  args: tableArgs(
    '| Step | Detail |\n|---|---|\n| 1 | Run the unit suite serially because the SessionScreen suites oversubscribe jest workers on a busy machine. |\n| 2 | Re-run any failure alone before calling it real. |',
  ),
}

export const InUserBubble: Story = {
  args: { ...tableArgs('| a | b |\n|---|---|\n| 1 | 2 |'), isUser: true },
  decorators: [(Story) => <View style={{ padding: 16, backgroundColor: '#2563eb', maxWidth: 360 }}><Story /></View>],
}
