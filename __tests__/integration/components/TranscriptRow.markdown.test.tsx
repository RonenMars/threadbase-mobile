import React from 'react'
import { render } from '@testing-library/react-native'
import { TranscriptRow } from '@/components/terminal/TranscriptRow'
import type { Message } from '@/types/api'
import '@/test-utils/i18n-setup'

function assistant(text: string): Message {
  return {
    id: 'm1',
    uuid: 'm1',
    role: 'assistant',
    content: [{ type: 'text', text }],
    timestamp: '2026-10-04T10:00:00.000Z',
  }
}

describe('TranscriptRow – markdown rendering', () => {
  it('leaves the source intact when the toggle is off', async () => {
    const { getByText, queryByTestId } = await render(
      <TranscriptRow message={assistant('## Summary\n\n- one')} />,
    )
    expect(queryByTestId('terminal-markdown')).toBeNull()
    expect(getByText('⏺ ## Summary\n  \n  - one')).toBeTruthy()
  })

  it('renders blocks when the toggle is on, with the raw markers gone', async () => {
    const { getByText, getByTestId, queryByText } = await render(
      <TranscriptRow message={assistant('## Summary\n\n- **one**')} renderMarkdown />,
    )
    expect(getByTestId('terminal-markdown')).toBeTruthy()
    expect(getByText('Summary')).toBeTruthy()
    expect(getByText('one')).toBeTruthy()
    expect(getByText('•')).toBeTruthy()
    expect(queryByText('## Summary')).toBeNull()
  })

  it('keeps the gutter glyph as its own element so list indentation is measured from the body', async () => {
    const { getByText } = await render(
      <TranscriptRow message={assistant('- item')} renderMarkdown />,
    )
    // The glyph is no longer concatenated into the prose string.
    expect(getByText('⏺')).toBeTruthy()
  })

  it('renders a fenced block without leaking the fence syntax', async () => {
    const { getByText, queryByText } = await render(
      <TranscriptRow message={assistant('Run:\n\n```bash\nnpm ci\n```')} renderMarkdown />,
    )
    expect(getByText('npm ci')).toBeTruthy()
    expect(queryByText('```bash')).toBeNull()
  })

  it('still renders prose it cannot classify, unstyled', async () => {
    const { getByText } = await render(
      <TranscriptRow message={assistant('| a | b |\n| 1 | 2 |')} renderMarkdown />,
    )
    expect(getByText('| a | b |\n| 1 | 2 |')).toBeTruthy()
  })

  it('does not touch user rows', async () => {
    const message: Message = { ...assistant('**not bold here**'), role: 'user' }
    const { getByText } = await render(<TranscriptRow message={message} renderMarkdown />)
    expect(getByText('❯ **not bold here**')).toBeTruthy()
  })

  it('leaves tool rows alone', async () => {
    const message: Message = {
      id: 'm2',
      uuid: 'm2',
      role: 'assistant',
      content: [{ type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'npm ci' } }],
      timestamp: '2026-10-04T10:00:00.000Z',
    }
    const { getByText } = await render(<TranscriptRow message={message} renderMarkdown />)
    expect(getByText('⏺ Bash(npm ci)')).toBeTruthy()
  })
})
