import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { ChatMarkdown } from './ChatMarkdown'
import { parseMarkdown } from '@/lib/markdown'

const meta: Meta<typeof ChatMarkdown> = {
  title: 'conversation/ChatMarkdown',
  component: ChatMarkdown,
  decorators: [(Story) => <View style={{ padding: 16, maxWidth: 360 }}><Story /></View>],
}
export default meta

type Story = StoryObj<typeof ChatMarkdown>

const ANSWER = [
  '## What I changed',
  '',
  'Two files, both under `lib/`:',
  '',
  '- **blocks.ts** — the line classifier',
  '- **inline.ts** — the span scanner',
  '',
  'Verify with:',
  '',
  '```bash',
  'npm run test:unit',
  '```',
  '',
  '> Nested emphasis renders as the outer span only.',
].join('\n')

export const Headings: Story = {
  args: { blocks: parseMarkdown('# Top level\n## Second\n### Third\n#### Fourth') },
}

export const InlineMarks: Story = {
  args: {
    blocks: parseMarkdown(
      'Plain, **strong**, *emphasis*, `inline code`, ~~struck~~ and [a link](https://example.test/docs).',
    ),
  },
}

export const Lists: Story = {
  args: {
    blocks: parseMarkdown(['- top level', '  - nested one', '    - nested twice', '', '1. first', '2. second'].join('\n')),
  },
}

export const AgentAnswer: Story = {
  args: { blocks: parseMarkdown(ANSWER) },
}

export const InUserBubble: Story = {
  args: { blocks: parseMarkdown('Make it **bold** and add `--watch`.'), isUser: true },
  decorators: [(Story) => <View style={{ padding: 16, backgroundColor: '#2563eb', maxWidth: 360 }}><Story /></View>],
}

// A line carrying the needle drops to a root HighlightText over its plain text,
// so the match is always visible and the anchor measurement stays on a real
// native view. Only the matched line loses its formatting, and only while a
// search is running — see the component's note.
export const SearchActiveMatch: Story = {
  args: { blocks: parseMarkdown(ANSWER), highlight: 'span scanner', activeMatch: true },
}

export const SearchInactiveMatch: Story = {
  args: { blocks: parseMarkdown(ANSWER), highlight: 'span scanner' },
}

// The needle is written with its markers, so it survives only in the source —
// that line falls back to rendering its source rather than hiding the match.
export const SearchNeedleWithMarkers: Story = {
  args: { blocks: parseMarkdown(ANSWER), highlight: '**inline.ts**', activeMatch: true },
}
