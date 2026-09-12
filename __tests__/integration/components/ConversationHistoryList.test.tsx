import React from 'react'
import { act, render, screen } from '@testing-library/react-native'
import { ConversationHistoryList } from '@/components/conversation/ConversationHistoryList'
import { createWrapper } from '@/test-utils'
import type { Message } from '@/types/api'

jest.mock('@/components/conversation/MessageItem', () => ({
  MessageItem: ({ message }: { message: Message }) => {
    const { Text } = jest.requireActual('react-native')
    return <Text>{message.id}</Text>
  },
}))

const messages: Message[] = [
  {
    id: 'm1',
    uuid: 'm1',
    role: 'user',
    content: [{ type: 'text', text: 'hi' }],
    timestamp: '',
    is_sidechain: false,
    parent_uuid: null,
  },
  {
    id: 'm2',
    uuid: 'm2',
    role: 'assistant',
    content: [{ type: 'text', text: 'a long last message' }],
    timestamp: '',
    is_sidechain: false,
    parent_uuid: null,
  },
]

describe('ConversationHistoryList first-load pin', () => {
  it('wires onLoad, content-size, and drag handlers so a tall last row can settle at the true bottom', async () => {
    await render(
      <ConversationHistoryList messages={messages} lastMessageId="m2" />,
      { wrapper: createWrapper() },
    )
    const list = screen.getByTestId('conversation-history-list')
    expect(list.props.onContentSizeChange).toEqual(expect.any(Function))
    expect(list.props.onScrollBeginDrag).toEqual(expect.any(Function))
    await act(async () => {
      list.props.onContentSizeChange?.(400, 4000)
      list.props.onScrollBeginDrag?.({ nativeEvent: {} })
    })
  })

  it('does not pin when auto-anchor is disabled for search', async () => {
    await render(
      <ConversationHistoryList messages={messages} lastMessageId="m2" disableAutoAnchor />,
      { wrapper: createWrapper() },
    )
    const list = screen.getByTestId('conversation-history-list')
    expect(list.props.maintainVisibleContentPosition).toMatchObject({ disabled: true })
    await act(async () => {
      list.props.onContentSizeChange?.(400, 4000)
    })
  })
})
