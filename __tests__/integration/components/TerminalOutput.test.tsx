import React from 'react'
import { StyleSheet } from 'react-native'
import { render } from '@testing-library/react-native'
import { TerminalOutput } from '@/components/terminal/TerminalOutput'

describe('TerminalOutput – rendering', () => {
  it('renders provided lines', async () => {
    const { getByText } = await render(
      <TerminalOutput lines={['hello world', 'second line']} isStreaming={false} />
    )
    expect(getByText('hello world')).toBeTruthy()
    expect(getByText('second line')).toBeTruthy()
  })

  it('renders line numbers starting at 1', async () => {
    const { getByText } = await render(
      <TerminalOutput lines={['line-a', 'line-b', 'line-c']} isStreaming={false} />
    )
    expect(getByText('1')).toBeTruthy()
    expect(getByText('2')).toBeTruthy()
    expect(getByText('3')).toBeTruthy()
  })

  it('renders empty state without crash', async () => {
    await render(<TerminalOutput lines={[]} isStreaming={false} />)
  })

  it('styles user transcript lines (❯-prefixed) with the accent colour', async () => {
    const { getByText } = await render(
      <TerminalOutput lines={['❯ Howdy', 'plain output']} isStreaming={false} />
    )
    const userLine = getByText('❯ Howdy')
    const flat = StyleSheet.flatten(userLine.props.style)
    expect(flat.color).toBe('#58a6ff')
    expect(flat.fontWeight).toBe('600')
    const plainLine = getByText('plain output')
    expect(StyleSheet.flatten(plainLine.props.style).color).toBe('#e6edf3')
  })
})

describe('TerminalOutput – ANSI stripping', () => {
  it('strips ANSI colour codes from lines', async () => {
    const { getByText } = await render(
      <TerminalOutput lines={['\x1b[32mGreen text\x1b[0m']} isStreaming={false} />
    )
    expect(getByText('Green text')).toBeTruthy()
  })

  it('strips bold/dim ANSI codes', async () => {
    const { getByText } = await render(
      <TerminalOutput lines={['\x1b[1mBold text\x1b[0m']} isStreaming={false} />
    )
    expect(getByText('Bold text')).toBeTruthy()
  })

  it('strips cursor movement codes', async () => {
    const { getByText } = await render(
      <TerminalOutput lines={['\x1b[2Kclean line']} isStreaming={false} />
    )
    expect(getByText('clean line')).toBeTruthy()
  })
})

describe('TerminalOutput – streaming indicator', () => {
  it('renders without crash when isStreaming=true', async () => {
    await render(<TerminalOutput lines={[]} isStreaming={true} />)
  })

  it('renders without crash when isStreaming=false', async () => {
    await render(<TerminalOutput lines={[]} isStreaming={false} />)
  })
})

describe('TerminalOutput – controls', () => {
  it('renders jump-to-bottom button', async () => {
    const { getByLabelText } = await render(
      <TerminalOutput lines={['line']} isStreaming={false} />
    )
    expect(getByLabelText('Jump to bottom')).toBeTruthy()
  })

  it('renders jump-to-top button', async () => {
    const { getByLabelText } = await render(
      <TerminalOutput lines={['line']} isStreaming={false} />
    )
    expect(getByLabelText('Jump to top')).toBeTruthy()
  })
})

describe('TerminalOutput – ground-truth user ownership', () => {
  const USER = '#58a6ff'
  const PLAIN = '#e6edf3'
  const colorOf = (node: { props: { style: unknown } }) => StyleSheet.flatten(node.props.style).color

  it('styles only ❯ lines confirmed by userMessageTexts', async () => {
    const { getByText } = await render(
      <TerminalOutput
        lines={['❯ real prompt', '❯ agent echo', 'plain output']}
        isStreaming={false}
        userMessageTexts={new Set(['real prompt'])}
      />
    )
    expect(colorOf(getByText('❯ real prompt'))).toBe(USER)
    // A ❯ line NOT in the set is agent-owned once ground truth is present.
    expect(colorOf(getByText('❯ agent echo'))).toBe(PLAIN)
    expect(colorOf(getByText('plain output'))).toBe(PLAIN)
  })

  it('falls back to the ❯ heuristic when the set is empty (old streamer)', async () => {
    const { getByText } = await render(
      <TerminalOutput
        lines={['❯ anything']}
        isStreaming={false}
        userMessageTexts={new Set()}
      />
    )
    expect(colorOf(getByText('❯ anything'))).toBe(USER)
  })
})

describe('TerminalOutput – row testIDs', () => {
  it('renders LineRow with testID for each line', async () => {
    const { queryAllByTestId } = await render(
      <TerminalOutput lines={['hello', 'world']} isStreaming={false} />
    )
    expect(queryAllByTestId('terminal-line-row')).toHaveLength(2)
  })
})
