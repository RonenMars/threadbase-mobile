import { mergeLiveMessages } from '@/utils/mergeLiveMessages'
import type { Message } from '@/types/api'

function historical(index: number, uuid: string, text: string): Message {
  return {
    id: `conv-${index}`,
    uuid,
    messageIndex: index,
    role: index % 2 === 0 ? 'user' : 'assistant',
    content: [{ type: 'text', text }],
    timestamp: `2026-07-19T10:00:0${index}Z`,
    is_sidechain: false,
    parent_uuid: null,
  }
}

// A live (WS-parsed) message keys its id off the uuid, not the conversation
// index — mirroring parseLineToMessage in useConversationStream.
function live(uuid: string, text: string, role: 'user' | 'assistant' = 'assistant'): Message {
  return {
    id: uuid,
    uuid,
    role,
    content: [{ type: 'text', text }],
    timestamp: `2026-07-19T11:00:00Z`,
    is_sidechain: false,
    parent_uuid: null,
  }
}

const texts = (msgs: Message[]) =>
  msgs.map((m) => (m.content.find((b) => b.type === 'text') as { text: string } | undefined)?.text)

describe('mergeLiveMessages', () => {
  it('appends live messages after REST history, preserving file/arrival order', () => {
    const hist = [historical(0, 'h0', 'first'), historical(1, 'h1', 'second')]
    const liveMsgs = [live('L0', 'live-third'), live('L1', 'live-fourth')]
    expect(texts(mergeLiveMessages(hist, liveMsgs))).toEqual([
      'first',
      'second',
      'live-third',
      'live-fourth',
    ])
  })

  it('returns the same array reference-content when there are no live messages', () => {
    const hist = [historical(0, 'h0', 'first')]
    expect(texts(mergeLiveMessages(hist, []))).toEqual(['first'])
  })

  it('drops a live message whose uuid already landed in REST history (WS + drain race)', () => {
    // The same turn arrives once over WS and again via the REST delta drain.
    // History carries the authoritative uuid, so the WS copy is deduped away.
    const hist = [historical(0, 'h0', 'hello'), historical(1, 'dup-uuid', 'echoed turn')]
    const liveMsgs = [live('dup-uuid', 'echoed turn')]
    const merged = mergeLiveMessages(hist, liveMsgs)
    expect(texts(merged)).toEqual(['hello', 'echoed turn'])
    expect(merged.filter((m) => m.uuid === 'dup-uuid')).toHaveLength(1)
  })

  it('dedups uuid-less messages that collide on fallback id', () => {
    const a: Message = { ...live('', 'x'), id: 'same', uuid: null }
    const b: Message = { ...live('', 'x'), id: 'same', uuid: null }
    expect(mergeLiveMessages([], [a, b])).toHaveLength(1)
  })

  it('splices the middle segment between history and live (optimistic bubbles)', () => {
    const hist = [historical(0, 'h0', 'first')]
    const middle = [{ ...live('opt', 'typing…', 'user'), id: 'optimistic-1', uuid: null }]
    const liveMsgs = [live('L0', 'reply')]
    expect(texts(mergeLiveMessages(hist, liveMsgs, middle))).toEqual(['first', 'typing…', 'reply'])
  })

  it('keeps history → middle → live order even when timestamps are out of order', () => {
    const hist = [{ ...historical(0, 'h0', 'first'), timestamp: '2026-07-24T00:00:02.000Z' }]
    const middle = [{ ...live('opt', 'typing…', 'user'), id: 'optimistic-1', uuid: null, timestamp: '2026-07-24T00:00:01.000Z' }]
    const liveMsgs = [{ ...live('L0', 'reply'), timestamp: '2026-07-24T00:00:00.000Z' }]
    expect(texts(mergeLiveMessages(hist, liveMsgs, middle))).toEqual(['first', 'typing…', 'reply'])
  })
})
