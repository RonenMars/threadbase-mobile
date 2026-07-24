import { parseConfidenceFromCounters, preferRawTerminal } from '@/lib/renderConfidence'

describe('preferRawTerminal', () => {
  it('forces terminal without a conversation id', () => {
    const result = preferRawTerminal({
      sessionView: 'chat',
      hasConversationId: false,
      conversationMessageCount: 0,
      ptyVisibleLineCount: 0,
      parseConfidence: 'high',
    })
    expect(result).toEqual({
      mode: 'terminal',
      reason: 'no_conversation',
      chatAuthoritative: false,
    })
  })

  it('forces terminal on low parse confidence', () => {
    const result = preferRawTerminal({
      sessionView: 'chat',
      hasConversationId: true,
      conversationMessageCount: 3,
      ptyVisibleLineCount: 10,
      parseConfidence: 'low',
    })
    expect(result.mode).toBe('terminal')
    expect(result.chatAuthoritative).toBe(false)
    expect(result.reason).toBe('low_parse_confidence')
  })

  it('forces terminal when chat is empty but PTY is active', () => {
    const result = preferRawTerminal({
      sessionView: 'chat',
      hasConversationId: true,
      conversationMessageCount: 0,
      ptyVisibleLineCount: 40,
      parseConfidence: 'high',
    })
    expect(result.reason).toBe('chat_empty_pty_active')
    expect(result.chatAuthoritative).toBe(false)
  })

  it('keeps chat when normalization looks healthy', () => {
    const result = preferRawTerminal({
      sessionView: 'chat',
      hasConversationId: true,
      conversationMessageCount: 2,
      ptyVisibleLineCount: 40,
      parseConfidence: 'high',
    })
    expect(result).toEqual({
      mode: 'chat',
      reason: 'user_preference',
      chatAuthoritative: true,
    })
  })
})

describe('parseConfidenceFromCounters', () => {
  it('stays high for clean streams', () => {
    expect(
      parseConfidenceFromCounters({
        unsupportedSequenceCount: 0,
        truncatedEscapeCount: 0,
        bytesFed: 10_000,
      }),
    ).toBe('high')
  })

  it('drops to low when unsupported sequences pile up', () => {
    expect(
      parseConfidenceFromCounters({
        unsupportedSequenceCount: 20,
        truncatedEscapeCount: 0,
        bytesFed: 2_000,
      }),
    ).toBe('low')
  })
})
