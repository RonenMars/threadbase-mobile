/**
 * The fork seam: a `codex fork` session serves its parent's messages ahead of
 * its own in one message_index space, and the list marks where that switches.
 * Placement is matched against the rendered rows, so the divider shows up only
 * once the page holding the boundary message is loaded.
 */
import React from 'react'
import { render } from '@testing-library/react-native'
import { ConversationHistoryList } from '@/components/conversation/ConversationHistoryList'
import { inheritedHistorySeam, type RawInheritedHistory } from '@/utils/inheritedHistory'
import type { Message } from '@/types/api'

function messagesFrom(from: number, count: number): Message[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `m-${from + i}`,
    messageIndex: from + i,
    role: 'assistant',
    timestamp: '2026-09-06T17:31:07.482Z',
    content: [{ type: 'text', text: `body ${from + i}` }],
  })) as Message[]
}

function renderList(raw: RawInheritedHistory | undefined, messages: Message[]) {
  return render(
    <ConversationHistoryList
      messages={messages}
      lastMessageId={messages[messages.length - 1]?.id}
      inheritedHistory={inheritedHistorySeam(raw)}
    />,
  )
}

const FORK: RawInheritedHistory = {
  source_id: '01a075cd-f290-7d63-9bd8-b37f70c2ef5f',
  source_provider: 'codex-cli',
  through_message_index: 21,
  forked_at: '2026-09-06T17:31:07.482Z',
  unavailable_reason: null,
}

describe('inherited-history seam in the message list', () => {
  it('draws the divider immediately before the boundary message', async () => {
    const { getByTestId, toJSON } = await render(
      <ConversationHistoryList
        messages={messagesFrom(19, 4)}
        lastMessageId="m-22"
        inheritedHistory={inheritedHistorySeam(FORK)}
      />,
    )
    expect(getByTestId('inherited-history-divider')).toBeTruthy()

    // lastIndexOf: the serialized tree opens with FlashList's `data` prop, so
    // the rendered rows are the later occurrence of each body.
    const tree = JSON.stringify(toJSON())
    expect(tree.lastIndexOf('body 20')).toBeLessThan(tree.lastIndexOf('Forked into Threadbase'))
    expect(tree.lastIndexOf('Forked into Threadbase')).toBeLessThan(tree.lastIndexOf('body 21'))
  })

  it('draws nothing while the boundary message is outside the loaded window', async () => {
    const { queryByTestId } = await renderList(FORK, messagesFrom(0, 5))
    expect(queryByTestId('inherited-history-divider')).toBeNull()
  })

  it('draws nothing when the server sends no inherited_history', async () => {
    const { queryByTestId } = await renderList(undefined, messagesFrom(19, 4))
    expect(queryByTestId('inherited-history-divider')).toBeNull()
    expect(queryByTestId('inherited-history-unavailable')).toBeNull()
  })

  it('draws nothing for a zero boundary with no reason', async () => {
    const { queryByTestId } = await renderList({ through_message_index: 0 }, messagesFrom(0, 3))
    expect(queryByTestId('inherited-history-divider')).toBeNull()
  })

  it('states once, at the top, that the parent history could not be read', async () => {
    const { getAllByTestId, getByText } = await renderList(
      { through_message_index: 0, unavailable_reason: 'source_missing' },
      messagesFrom(0, 3),
    )
    expect(getAllByTestId('inherited-history-unavailable')).toHaveLength(1)
    expect(getByText("Earlier history from before this fork isn't available.")).toBeTruthy()
  })

  it('renders the conversation unchanged when inherited_history is malformed', async () => {
    const malformed = {
      source_id: 42,
      through_message_index: '21',
      forked_at: { at: 'now' },
      unavailable_reason: 7,
    } as unknown as RawInheritedHistory

    const { queryByTestId, getByText } = await renderList(malformed, messagesFrom(19, 4))
    expect(queryByTestId('inherited-history-divider')).toBeNull()
    expect(queryByTestId('inherited-history-unavailable')).toBeNull()
    expect(getByText('body 21')).toBeTruthy()
  })

  it('falls back to the untimed label when forked_at is unusable', async () => {
    const { getByText } = await renderList(
      { through_message_index: 21, forked_at: 'not-a-date' },
      messagesFrom(19, 4),
    )
    expect(getByText('Forked into Threadbase')).toBeTruthy()
  })
})
