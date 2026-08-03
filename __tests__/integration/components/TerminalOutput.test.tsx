import React from 'react'
import { StyleSheet } from 'react-native'
import { fireEvent, render } from '@testing-library/react-native'
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
    expect(getByLabelText('Scroll to bottom')).toBeTruthy()
  })

  it('renders jump-to-top button', async () => {
    const { getByLabelText } = await render(
      <TerminalOutput lines={['line']} isStreaming={false} />
    )
    expect(getByLabelText('Scroll to top')).toBeTruthy()
  })
})

describe('TerminalOutput – ground-truth user ownership', () => {
  const USER = '#58a6ff'
  const PLAIN = '#e6edf3'
  type TextNode = ReturnType<Awaited<ReturnType<typeof render>>['getByText']>
  const colorOf = (node: TextNode) => StyleSheet.flatten(node.props.style).color

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

describe('TerminalOutput – wrapped prompt collapsing', () => {
  it('collapses a wrapped user prompt into one highlighted row', async () => {
    const wrappedLines = [
      '❯ this is a long prompt that got',
      'wrapped across multiple',
      'terminal rows',
    ]
    const userMessageTexts = new Set([
      'this is a long prompt that got wrapped across multiple terminal rows',
    ])

    const { queryByText } = await render(
      <TerminalOutput
        lines={wrappedLines}
        isStreaming={false}
        userMessageTexts={userMessageTexts}
      />
    )

    expect(
      queryByText('❯ this is a long prompt that got wrapped across multiple terminal rows')
    ).toBeTruthy()
    expect(queryByText('wrapped across multiple')).toBeNull()
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

describe('TerminalOutput – resumed scrollback notice', () => {
  it('does not render the notice without onViewResumedConversation', async () => {
    const { queryByTestId } = await render(
      <TerminalOutput lines={[]} isStreaming={false} />
    )
    expect(queryByTestId('terminal-resumed-scrollback-notice')).toBeNull()
  })

  it('renders the notice at the top of scrollback when the callback is set', async () => {
    const onView = jest.fn()
    const { getByTestId, getByText } = await render(
      <TerminalOutput
        lines={['startup']}
        isStreaming={false}
        onViewResumedConversation={onView}
      />
    )
    expect(getByTestId('terminal-resumed-scrollback-notice')).toBeTruthy()
    expect(getByText("Earlier output isn't available for a resumed session.")).toBeTruthy()
    expect(getByText('View the conversation history →')).toBeTruthy()
  })

  it('invokes onViewResumedConversation when the notice is pressed', async () => {
    const onView = jest.fn()
    const { getByTestId } = await render(
      <TerminalOutput
        lines={[]}
        isStreaming={false}
        onViewResumedConversation={onView}
      />
    )
    await fireEvent.press(getByTestId('terminal-resumed-scrollback-notice'))
    expect(onView).toHaveBeenCalledTimes(1)
  })
})
