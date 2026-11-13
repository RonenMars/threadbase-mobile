import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { Text, View } from 'react-native'
import { TerminalRunSpans } from './TerminalRunSpans'
import { VirtualTerminal, type TerminalRun } from '@/services/virtual-terminal'

function runsOf(ansi: string): TerminalRun[] {
  const vt = new VirtualTerminal()
  vt.feed(ansi)
  const [line] = vt.getLines()
  return vt.getLineStyles().get(line) ?? [{ text: line, style: {} }]
}

const meta: Meta<typeof TerminalRunSpans> = {
  title: 'terminal/TerminalRunSpans',
  component: TerminalRunSpans,
  decorators: [(Story) => <View style={{ padding: 16 }}><Story /></View>],
  render: (args) => (
    <Text style={{ fontFamily: 'monospace', fontSize: 13 }}>
      <TerminalRunSpans {...args} />
    </Text>
  ),
}
export default meta

type Story = StoryObj<typeof TerminalRunSpans>

export const SixteenColours: Story = {
  args: {
    runs: runsOf(
      Array.from({ length: 8 }, (_, i) => `\x1b[${30 + i}m fg${i} \x1b[${90 + i}m br${i} `).join('') + '\x1b[0m',
    ),
  },
}

export const Backgrounds: Story = {
  args: {
    runs: runsOf(Array.from({ length: 8 }, (_, i) => `\x1b[${40 + i}m bg${i} `).join('') + '\x1b[0m'),
  },
}

export const Attributes: Story = {
  args: {
    runs: runsOf('\x1b[1mbold\x1b[22m \x1b[2mdim\x1b[22m \x1b[3mitalic\x1b[23m \x1b[4munderline\x1b[24m \x1b[7minverse\x1b[0m plain'),
  },
}

export const ExtendedColours: Story = {
  args: {
    runs: runsOf('\x1b[38;5;208m256-orange \x1b[38;5;45m256-cyan \x1b[38;2;255;105;180mtruecolor-pink \x1b[48;5;236;38;5;250m grey-ramp \x1b[0m'),
  },
}

export const GitDiffStat: Story = {
  args: {
    runs: runsOf(' services/virtual-terminal.ts | 42 \x1b[32m++++++++++++\x1b[31m---\x1b[0m'),
  },
}
