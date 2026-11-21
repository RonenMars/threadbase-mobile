/**
 * Claude Code's compaction summary is a generated `type: user` row the human
 * never typed. It renders as a collapsed system card, not a user bubble.
 */
import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import { MessageItem } from '@/components/conversation/MessageItem'
import type { Message } from '@/types/api'
import '@/test-utils/i18n-setup'

function summary(extra: Partial<Message> = {}): Message {
  return {
    id: 'm-564',
    messageIndex: 564,
    role: 'user',
    timestamp: '2026-11-20T13:00:07.952Z',
    content: [{ type: 'text', text: 'This session is being continued.\n\nSummary:\n1. **Primary Request**' }],
    is_compact_summary: true,
    compaction: { trigger: 'auto', preTokens: 266778, postTokens: 28645 },
    ...extra,
  }
}

describe('MessageItem – compaction summary', () => {
  it('renders a collapsed card instead of a user bubble', async () => {
    const { getByTestId, queryByTestId, queryByText } = await render(<MessageItem message={summary()} />)
    expect(getByTestId('compaction-card')).toBeTruthy()
    expect(queryByTestId('message-bubble')).toBeNull()
    expect(queryByText(/Primary Request/)).toBeNull()
  })

  it('shows the trigger and token counts in the header', async () => {
    const { getByText } = await render(<MessageItem message={summary()} />)
    expect(getByText(/267k → 29k/)).toBeTruthy()
  })

  it('expands to the summary on press', async () => {
    const { getByTestId, getByText } = await render(<MessageItem message={summary()} />)
    await fireEvent.press(getByTestId('compaction-card-toggle'))
    expect(getByText('Primary Request')).toBeTruthy()
  })

  it('omits the stats when the server sent none', async () => {
    const { getByTestId, queryByText } = await render(<MessageItem message={summary({ compaction: null })} />)
    expect(getByTestId('compaction-card')).toBeTruthy()
    expect(queryByText(/→/)).toBeNull()
  })

  it('still renders an ordinary user message as a bubble', async () => {
    const { getByTestId, queryByTestId } = await render(
      <MessageItem message={summary({ is_compact_summary: undefined, compaction: undefined })} />,
    )
    expect(getByTestId('message-bubble')).toBeTruthy()
    expect(queryByTestId('compaction-card')).toBeNull()
  })
})
