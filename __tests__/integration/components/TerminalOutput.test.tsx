import React from 'react'
import { render } from '@testing-library/react-native'
import { TerminalOutput } from '@/components/terminal/TerminalOutput'
import type { TerminalLine } from '@/hooks/useTerminalStream'

describe('TerminalOutput – rendering', () => {
  it('renders provided lines', () => {
    const { getByText } = render(
      <TerminalOutput lines={['hello world', 'second line']} isStreaming={false} />
    )
    expect(getByText('hello world')).toBeTruthy()
    expect(getByText('second line')).toBeTruthy()
  })

  it('renders line numbers starting at 1', () => {
    const { getByText } = render(
      <TerminalOutput lines={['line-a', 'line-b', 'line-c']} isStreaming={false} />
    )
    expect(getByText('1')).toBeTruthy()
    expect(getByText('2')).toBeTruthy()
    expect(getByText('3')).toBeTruthy()
  })

  it('renders empty state without crash', () => {
    expect(() =>
      render(<TerminalOutput lines={[]} isStreaming={false} />)
    ).not.toThrow()
  })
})

describe('TerminalOutput – ANSI stripping', () => {
  it('strips ANSI colour codes from lines', () => {
    const { getByText } = render(
      <TerminalOutput lines={['\x1b[32mGreen text\x1b[0m']} isStreaming={false} />
    )
    expect(getByText('Green text')).toBeTruthy()
  })

  it('strips bold/dim ANSI codes', () => {
    const { getByText } = render(
      <TerminalOutput lines={['\x1b[1mBold text\x1b[0m']} isStreaming={false} />
    )
    expect(getByText('Bold text')).toBeTruthy()
  })

  it('strips cursor movement codes', () => {
    const { getByText } = render(
      <TerminalOutput lines={['\x1b[2Kclean line']} isStreaming={false} />
    )
    expect(getByText('clean line')).toBeTruthy()
  })
})

describe('TerminalOutput – streaming indicator', () => {
  it('renders without crash when isStreaming=true', () => {
    expect(() =>
      render(<TerminalOutput lines={[]} isStreaming={true} />)
    ).not.toThrow()
  })

  it('renders without crash when isStreaming=false', () => {
    expect(() =>
      render(<TerminalOutput lines={[]} isStreaming={false} />)
    ).not.toThrow()
  })
})

describe('TerminalOutput – controls', () => {
  it('renders jump-to-bottom button', () => {
    const { getByLabelText } = render(
      <TerminalOutput lines={['line']} isStreaming={false} />
    )
    expect(getByLabelText('Jump to bottom')).toBeTruthy()
  })

  it('renders jump-to-top button', () => {
    const { getByLabelText } = render(
      <TerminalOutput lines={['line']} isStreaming={false} />
    )
    expect(getByLabelText('Jump to top')).toBeTruthy()
  })
})

describe('TerminalOutput – divider rows', () => {
  it('renders YOU label for a divider entry', () => {
    const lines: TerminalLine[] = [
      'normal line',
      { __divider: true, text: 'run the tests' },
    ]
    const { getByText } = render(
      <TerminalOutput lines={lines} isStreaming={false} />
    )
    expect(getByText('YOU')).toBeTruthy()
    expect(getByText('run the tests')).toBeTruthy()
  })

  it('renders mixed string and divider lines without crash', () => {
    const lines: TerminalLine[] = [
      'line one',
      { __divider: true, text: 'hello' },
      'line two',
    ]
    expect(() =>
      render(<TerminalOutput lines={lines} isStreaming={false} />)
    ).not.toThrow()
  })

  it('does not render a line number for divider entries', () => {
    const lines: TerminalLine[] = [
      { __divider: true, text: 'only divider' },
    ]
    const { queryByText } = render(
      <TerminalOutput lines={lines} isStreaming={false} />
    )
    // Line number "1" should not appear — divider has no gutter
    expect(queryByText('1')).toBeNull()
  })

  it('renders DividerRow with testID for divider entries', () => {
    const lines: TerminalLine[] = [
      { __divider: true, text: 'sent text' },
    ]
    const { queryAllByTestId } = render(
      <TerminalOutput lines={lines} isStreaming={false} />
    )
    expect(queryAllByTestId('divider-row')).toHaveLength(1)
    expect(queryAllByTestId('terminal-line-row')).toHaveLength(0)
  })

  it('renders LineRow with testID for string entries', () => {
    const lines: TerminalLine[] = ['hello', 'world']
    const { queryAllByTestId } = render(
      <TerminalOutput lines={lines} isStreaming={false} />
    )
    expect(queryAllByTestId('terminal-line-row')).toHaveLength(2)
    expect(queryAllByTestId('divider-row')).toHaveLength(0)
  })

  it('renders both DividerRow and LineRow for mixed entries', () => {
    const lines: TerminalLine[] = [
      'first',
      { __divider: true, text: 'YOU said this' },
      'second',
    ]
    const { queryAllByTestId } = render(
      <TerminalOutput lines={lines} isStreaming={false} />
    )
    expect(queryAllByTestId('terminal-line-row')).toHaveLength(2)
    expect(queryAllByTestId('divider-row')).toHaveLength(1)
  })
})
