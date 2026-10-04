import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { TerminalMarkdown } from './TerminalMarkdown'
import { parseMarkdown } from '@/lib/markdown'

const meta: Meta<typeof TerminalMarkdown> = {
  title: 'terminal/TerminalMarkdown',
  component: TerminalMarkdown,
  decorators: [(Story) => <View style={{ padding: 16, backgroundColor: '#0d1117' }}><Story /></View>],
}
export default meta

type Story = StoryObj<typeof TerminalMarkdown>

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
    blocks: parseMarkdown(
      ['- top level item', '  - nested one', '    - nested twice', '', '1. first', '2. second'].join('\n'),
    ),
  },
}

export const QuoteAndRule: Story = {
  args: { blocks: parseMarkdown('> Tables are still out of scope.\n> They render as literal pipes.\n\n---\n\nAfter the break.') },
}

export const CodeBlock: Story = {
  args: { blocks: parseMarkdown('Run:\n\n```bash\nnpm ci\nnpm run test:unit\n```\n\nThen push.') },
}

export const AgentAnswer: Story = {
  args: {
    blocks: parseMarkdown(
      [
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
      ].join('\n'),
    ),
  },
}

// The subset's edges, kept visible so a regression shows up in the catalog
// rather than in someone's session.
export const DegradedCases: Story = {
  args: {
    blocks: parseMarkdown(
      [
        'A table falls through as literal text:',
        '',
        '| col | col |',
        '| 1 | 2 |',
        '',
        'So does arithmetic: 2 * 3 * 4, and snake_case_names.',
        '',
        '**An unclosed mark stays literal.',
      ].join('\n'),
    ),
  },
}
