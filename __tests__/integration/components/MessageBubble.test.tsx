import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { MessageBubble } from '@/components/conversation/MessageBubble'
import type { Message } from '@/types/api'

const makeMessage = (overrides: Partial<Message> = {}): Message => ({
  id: 'msg-1',
  role: 'user',
  content: [{ type: 'text', text: 'Hello!' }],
  timestamp: '2024-01-01T00:00:00Z',
  ...overrides,
})

describe('MessageBubble – text content', () => {
  it('renders user message text', () => {
    const { getByText } = render(<MessageBubble message={makeMessage()} />)
    expect(getByText('Hello!')).toBeTruthy()
  })

  it('renders assistant message text', () => {
    const { getByText } = render(
      <MessageBubble message={makeMessage({ role: 'assistant', content: [{ type: 'text', text: 'How can I help?' }] })} />
    )
    expect(getByText('How can I help?')).toBeTruthy()
  })

  it('renders token count when provided', () => {
    const { getByText } = render(<MessageBubble message={makeMessage({ tokens: 42 })} />)
    expect(getByText('42 tokens')).toBeTruthy()
  })

  it('does not render token count when absent', () => {
    const { queryByText } = render(<MessageBubble message={makeMessage({ tokens: undefined })} />)
    expect(queryByText(/tokens/)).toBeNull()
  })
})

describe('MessageBubble – text collapse', () => {
  const longText = Array.from({ length: 15 }, (_, i) => `line ${i + 1}`).join('\n')

  it('shows collapse toggle for text over 10 lines', () => {
    const { getByText } = render(
      <MessageBubble message={makeMessage({ content: [{ type: 'text', text: longText }] })} />
    )
    expect(getByText('Show all 15 lines')).toBeTruthy()
  })

  it('expands text when toggle is pressed', () => {
    const { getByText } = render(
      <MessageBubble message={makeMessage({ content: [{ type: 'text', text: longText }] })} />
    )
    fireEvent.press(getByText('Show all 15 lines'))
    expect(getByText('Show less')).toBeTruthy()
  })

  it('collapses again when "Show less" is pressed', () => {
    const { getByText } = render(
      <MessageBubble message={makeMessage({ content: [{ type: 'text', text: longText }] })} />
    )
    fireEvent.press(getByText('Show all 15 lines'))
    fireEvent.press(getByText('Show less'))
    expect(getByText('Show all 15 lines')).toBeTruthy()
  })

  it('does not show toggle for short text', () => {
    const shortText = 'just one line'
    const { queryByText } = render(
      <MessageBubble message={makeMessage({ content: [{ type: 'text', text: shortText }] })} />
    )
    expect(queryByText(/Show all/)).toBeNull()
  })
})

describe('MessageBubble – code blocks', () => {
  it('renders code block with Copy button', () => {
    const msgWithCode = makeMessage({
      content: [{ type: 'text', text: '```\nconsole.log("hi")\n```' }],
    })
    const { getByText } = render(<MessageBubble message={msgWithCode} />)
    expect(getByText('Copy')).toBeTruthy()
    expect(getByText('Code')).toBeTruthy()
  })
})

describe('MessageBubble – tool_use', () => {
  it('renders tool use tag with emoji', () => {
    const { getByText } = render(
      <MessageBubble
        message={makeMessage({
          content: [{ type: 'tool_use', name: 'Bash', input: { command: 'ls' } }],
        })}
      />
    )
    expect(getByText('🔧 Bash')).toBeTruthy()
  })
})
