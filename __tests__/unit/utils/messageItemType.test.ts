import { LONG_TEXT_CHARS, messageItemType } from '@/utils/messageItemType'
import type { Message, MessageContent } from '@/types/api'

function message(role: Message['role'], content: MessageContent[]): Message {
  return { id: 'm', role, content, timestamp: '2026-09-19T10:00:00Z' }
}

const text = (length: number): MessageContent => ({ type: 'text', text: 'x'.repeat(length) })

describe('messageItemType', () => {
  it('keeps the existing shape-based types', () => {
    expect(messageItemType(message('user', [text(10)]))).toBe('user')
    expect(messageItemType(message('assistant', [text(10)]))).toBe('assistant')
    expect(
      messageItemType(message('assistant', [{ type: 'thinking', thinking: 'hmm' } as MessageContent])),
    ).toBe('thinking')
  })

  // FlashList estimates every unmeasured row of a type from the running average
  // of that type's measured rows. One 8,000-char answer (~5,600pt) sharing a
  // type with one-line replies (~60pt) inflates that average, so the list
  // renders only a row or two per layout commit and React aborts the chain
  // with "Maximum update depth exceeded".
  it('gives a long text answer its own type, apart from short replies', () => {
    const long = messageItemType(message('assistant', [text(8216)]))
    const short = messageItemType(message('assistant', [text(44)]))
    expect(long).not.toBe(short)
    expect(long).toBe('assistantLong')
  })

  it('splits long user text the same way', () => {
    expect(messageItemType(message('user', [text(5000)]))).toBe('userLong')
  })

  it('sums text across blocks when deciding whether a row is long', () => {
    expect(messageItemType(message('assistant', [text(700), text(700)]))).toBe('assistantLong')
  })

  it('treats exactly the threshold as short and one char more as long', () => {
    expect(messageItemType(message('assistant', [text(LONG_TEXT_CHARS)]))).toBe('assistant')
    expect(messageItemType(message('assistant', [text(LONG_TEXT_CHARS + 1)]))).toBe('assistantLong')
  })

  it('does not let long text override the tool, diff or thinking types', () => {
    const tool: MessageContent = { type: 'tool_use', name: 'Bash', input: {} }
    expect(messageItemType(message('assistant', [text(5000), tool]))).toBe('tool')
  })
})
