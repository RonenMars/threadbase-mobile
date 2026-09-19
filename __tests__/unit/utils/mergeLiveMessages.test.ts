import { mergeLiveMessages, resolveToolNames } from '@/utils/mergeLiveMessages'
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

  // REST Cursor messages carry uuid: null; live lines carry cursor-<role>-<hex>.
  // Only the shared message_index / seq numbering ties the two copies together.
  describe('Cursor (REST uuid is null)', () => {
    const cursorRest = (index: number, text: string): Message => ({ ...historical(index, '', text), uuid: null })
    const cursorLive = (uuid: string, text: string, messageIndex?: number): Message => ({
      ...live(uuid, text),
      messageIndex,
    })

    it('drops a live message whose messageIndex history already holds', () => {
      const hist = [cursorRest(0, 'fix the header'), cursorRest(1, 'Reading the file.')]
      const liveMsgs = [cursorLive('cursor-assistant-9f3c1a7be2d04c86', 'Reading the file.', 1)]
      expect(texts(mergeLiveMessages(hist, liveMsgs))).toEqual(['fix the header', 'Reading the file.'])
    })

    it('keeps a live message with a new messageIndex', () => {
      const hist = [cursorRest(0, 'fix the header'), cursorRest(1, 'Reading the file.')]
      const liveMsgs = [cursorLive('cursor-assistant-4b8e0d2f6a1c9e37', 'Done.', 2)]
      expect(texts(mergeLiveMessages(hist, liveMsgs))).toEqual(['fix the header', 'Reading the file.', 'Done.'])
    })

    it('keeps a live message with no messageIndex and no uuid match (bind replay)', () => {
      const hist = [cursorRest(0, 'fix the header')]
      const liveMsgs = [cursorLive('cursor-assistant-7d2a5e9c0f1b3864', 'Replayed line.')]
      expect(texts(mergeLiveMessages(hist, liveMsgs))).toEqual(['fix the header', 'Replayed line.'])
    })
  })
})

describe('resolveToolNames', () => {
  const msg = (id: string, content: Message['content']): Message => ({
    id,
    uuid: id,
    role: 'assistant',
    content,
    timestamp: '2026-09-19T08:12:03.411Z',
    is_sidechain: false,
    parent_uuid: null,
  })

  it('names a result after its call in an earlier message', () => {
    const call = msg('m0', [{ type: 'tool_use', id: 'call_A', name: 'exec_command', input: { cmd: 'ls' } }])
    const result = msg('m1', [{ type: 'tool_result', toolUseId: 'call_A', toolName: 'Tool', content: 'a.ts' }])
    const [, resolved] = resolveToolNames([call, result])
    expect(resolved.content[0]).toMatchObject({ toolName: 'exec_command' })
    expect(result.content[0]).toMatchObject({ toolName: 'Tool' })
  })

  it('keeps the fallback label when the call is outside the loaded window', () => {
    const result = msg('m1', [{ type: 'tool_result', toolUseId: 'call_paged_out', toolName: 'Tool', content: 'a.ts' }])
    const [resolved] = resolveToolNames([result])
    expect(resolved).toBe(result)
  })
})
