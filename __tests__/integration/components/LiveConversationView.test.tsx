/**
 * LiveConversationView — bubble chat view behavior.
 *
 * Guards two regressions from PR #148:
 *  - Bug 2: a message the user sends must appear in the bubble list
 *    immediately (optimistic echo), not only after the JSONL round-trips
 *    back over the WebSocket.
 */
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { LiveConversationView } from '@/components/conversation/LiveConversationView'
import { createWrapper } from '@/test-utils'
import type { Message } from '@/types/api'

const mockMutate = jest.fn()

let mockHistorical: Message[] = []
let mockLive: Message[] = []

jest.mock('@/hooks/useConversations', () => ({
  useConversation: () => ({ data: { messages: mockHistorical } }),
}))

jest.mock('@/hooks/useConversationStream', () => ({
  useConversationStream: () => ({ liveMessages: mockLive }),
}))

jest.mock('@/hooks/useSessionActions', () => ({
  useSessionActions: () => ({ sendInput: { mutate: mockMutate } }),
}))

function renderView() {
  return render(
    <LiveConversationView serverId="srv1" sessionId="sess1" conversationId="conv1" />,
    { wrapper: createWrapper() },
  )
}

describe('LiveConversationView — optimistic sent message', () => {
  beforeEach(() => {
    mockMutate.mockClear()
    mockHistorical = []
    mockLive = []
  })

  it('shows the sent message in the bubbles immediately, before any WS echo', () => {
    renderView()

    const input = screen.getByTestId('chat-message-input')
    fireEvent.changeText(input, 'hello there')
    fireEvent.press(screen.getByTestId('chat-send-button'))

    // It still fires the send mutation…
    expect(mockMutate).toHaveBeenCalledWith('hello there')
    // …and the user's text shows up right away as a bubble, with no live echo.
    expect(screen.getByText('hello there')).toBeTruthy()
  })

  it('does not duplicate the message once the WS echo arrives with the same text', () => {
    const { rerender } = renderView()

    const input = screen.getByTestId('chat-message-input')
    fireEvent.changeText(input, 'ping')
    fireEvent.press(screen.getByTestId('chat-send-button'))
    expect(screen.getByText('ping')).toBeTruthy()

    // The streamer echoes the user turn back over the WS.
    mockLive = [
      {
        id: 'echo-1',
        uuid: 'echo-1',
        role: 'user',
        content: [{ type: 'text', text: 'ping' }],
        timestamp: '2026-06-18T10:00:00Z',
        is_sidechain: false,
        parent_uuid: null,
      },
    ]
    rerender(<LiveConversationView serverId="srv1" sessionId="sess1" conversationId="conv1" />)

    expect(screen.getAllByText('ping')).toHaveLength(1)
  })
})
