import React from 'react'
import { render } from '@testing-library/react-native'
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
