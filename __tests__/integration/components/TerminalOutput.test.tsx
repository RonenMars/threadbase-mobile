import React from 'react'
import { render } from '@testing-library/react-native'
import { TerminalOutput } from '@/components/terminal/TerminalOutput'

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
