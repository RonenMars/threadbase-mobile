/**
 * In-chat search tinting: every row holding the query is emphasised, while the
 * things that must stay singular — the anchor test id, the layout report that
 * aims the scroll, and a tool card force-opening — fire only on the active row.
 */
import React from 'react'
import { render } from '@testing-library/react-native'
import { MessageItem } from '@/components/conversation/MessageItem'
import { ConversationHistoryList } from '@/components/conversation/ConversationHistoryList'
import type { Message } from '@/types/api'

function textMessage(index: number, text: string): Message {
  return {
    id: `m-${index}`,
    messageIndex: index,
    role: 'assistant',
    timestamp: '2026-06-10T10:00:00Z',
    content: [{ type: 'text', text }],
  } as Message
}

function toolMessage(index: number, content: string): Message {
  return {
    id: `t-${index}`,
    messageIndex: index,
    role: 'assistant',
    timestamp: '2026-06-10T10:00:00Z',
    content: [{ type: 'tool_result', toolName: 'Bash', content }],
  } as Message
}

describe('MessageItem – in-chat search tinting', () => {
  it('leaves a non-matching row alone', async () => {
    const { queryAllByText } = await render(
      <MessageItem message={textMessage(4, 'nothing to see here')} highlight="tmux" />,
    )
    expect(queryAllByText('tmux')).toHaveLength(0)
  })

  it('tags only the active row with the anchor test id', async () => {
    const active = await render(
      <MessageItem message={textMessage(5, 'tmux again')} highlight="tmux" isActiveMatch />,
    )
    expect(active.queryAllByTestId('search-anchor-message')).toHaveLength(1)

    const inactive = await render(
      <MessageItem message={textMessage(6, 'tmux again')} highlight="tmux" />,
    )
    expect(inactive.queryAllByTestId('search-anchor-message')).toHaveLength(0)
  })

  it('force-opens a matching tool card only on the active row', async () => {
    const body = 'restarting tmux-resurrect now'

    const inactive = await render(
      <MessageItem message={toolMessage(8, body)} highlight="tmux" />,
    )
    expect(inactive.queryByText(body)).toBeNull()

    const active = await render(
      <MessageItem message={toolMessage(9, body)} highlight="tmux" isActiveMatch />,
    )
    // Force-opened, so the body is mounted; the match is split out of the run.
    expect(active.queryAllByText('tmux').length).toBeGreaterThan(0)
  })
})

describe('ConversationHistoryList – in-chat search tinting', () => {
  it('tints every matching row, not only the active one', async () => {
    const messages = [
      textMessage(0, 'first mention of tmux'),
      textMessage(1, 'nothing here'),
      textMessage(2, 'second mention of tmux'),
    ]
    const { queryAllByText, queryAllByTestId } = await render(
      <ConversationHistoryList
        messages={messages}
        lastMessageId="m-2"
        highlight="tmux"
        highlightIndex={2}
      />,
    )
    // Both matching rows split the token out; the third row contributes none.
    expect(queryAllByText('tmux')).toHaveLength(2)
    // ...but only one row is the anchor.
    expect(queryAllByTestId('search-anchor-message')).toHaveLength(1)
  })

  it('tints nothing when no search is active', async () => {
    const { queryAllByText } = await render(
      <ConversationHistoryList
        messages={[textMessage(0, 'first mention of tmux')]}
        lastMessageId="m-0"
      />,
    )
    expect(queryAllByText('tmux')).toHaveLength(0)
  })
})
