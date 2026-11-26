import { countAgentRepliesAfter, latestTimestamp } from '@/utils/countAgentReplies'
import type { Message } from '@/types/api'

function msg(
  id: string,
  role: 'user' | 'assistant',
  content: Message['content'],
  timestamp: string,
  extra: Partial<Message> = {},
): Message {
  return { id, uuid: id, role, content, timestamp, is_sidechain: false, parent_uuid: null, ...extra }
}

const text = (t: string) => ({ type: 'text' as const, text: t })
const tool = { type: 'tool_use' as const, id: 't1', name: 'Read', input: {} }
const toolResult = { type: 'tool_result' as const, toolUseId: 't1', toolName: 'Read', content: 'ok' }

const AWAY = '2026-11-23T01:00:00.000Z'

describe('countAgentRepliesAfter', () => {
  it('counts assistant text messages after the baseline', () => {
    const ms = [
      msg('a', 'assistant', [text('before')], '2026-11-23T00:59:00.000Z'),
      msg('b', 'assistant', [text('one')], '2026-11-23T01:01:00.000Z'),
      msg('c', 'assistant', [text('two')], '2026-11-23T01:02:00.000Z'),
    ]
    expect(countAgentRepliesAfter(ms, AWAY)).toBe(2)
  })

  it('ignores tool calls, tool results, thinking, user turns and blank text', () => {
    const ms = [
      msg('a', 'assistant', [tool], '2026-11-23T01:01:00.000Z'),
      msg('b', 'user', [toolResult], '2026-11-23T01:02:00.000Z'),
      msg('c', 'assistant', [{ type: 'thinking', thinking: 'hm' }], '2026-11-23T01:03:00.000Z'),
      msg('d', 'user', [text('a question from me')], '2026-11-23T01:04:00.000Z'),
      msg('e', 'assistant', [text('   ')], '2026-11-23T01:05:00.000Z'),
    ]
    expect(countAgentRepliesAfter(ms, AWAY)).toBe(0)
  })

  it('counts a message holding both text and a tool call once', () => {
    const ms = [msg('a', 'assistant', [text('Reading it now'), tool], '2026-11-23T01:01:00.000Z')]
    expect(countAgentRepliesAfter(ms, AWAY)).toBe(1)
  })

  it('ignores sub-agent (sidechain) replies', () => {
    const ms = [
      msg('a', 'assistant', [text('sub-agent output')], '2026-11-23T01:01:00.000Z', { is_sidechain: true }),
      msg('b', 'assistant', [text('main reply')], '2026-11-23T01:02:00.000Z'),
    ]
    expect(countAgentRepliesAfter(ms, AWAY)).toBe(1)
  })

  it('orders timestamps as instants, not strings', () => {
    // As strings "…:00.500Z" sorts before "…:00Z", so a reply 0.5s after the baseline would be dropped.
    const ms = [msg('a', 'assistant', [text('later')], '2026-11-23T01:00:00.500Z')]
    expect(countAgentRepliesAfter(ms, '2026-11-23T01:00:00Z')).toBe(1)
  })

  it('does not count a reply at the baseline instant', () => {
    const ms = [msg('a', 'assistant', [text('same')], AWAY)]
    expect(countAgentRepliesAfter(ms, AWAY)).toBe(0)
  })

  it('counts nothing when there is no usable baseline', () => {
    const ms = [msg('a', 'assistant', [text('x')], '2026-11-23T01:01:00.000Z')]
    expect(countAgentRepliesAfter(ms, '')).toBe(0)
    expect(countAgentRepliesAfter(ms, 'not a date')).toBe(0)
  })

  it('skips a message with an empty or malformed timestamp instead of counting it', () => {
    const ms = [msg('a', 'assistant', [text('x')], ''), msg('b', 'assistant', [text('y')], 'garbage')]
    expect(countAgentRepliesAfter(ms, AWAY)).toBe(0)
  })
})

describe('latestTimestamp', () => {
  it('returns the last message that has a usable timestamp', () => {
    const ms = [
      msg('a', 'assistant', [text('x')], '2026-11-23T00:59:00.000Z'),
      msg('b', 'assistant', [text('y')], '2026-11-23T01:01:00.000Z'),
      // an optimistic send carries '' until its echo lands
      msg('c', 'user', [text('typed')], ''),
    ]
    expect(latestTimestamp(ms)).toBe('2026-11-23T01:01:00.000Z')
  })

  it('returns null when nothing has a timestamp', () => {
    expect(latestTimestamp([])).toBeNull()
    expect(latestTimestamp([msg('a', 'user', [text('x')], '')])).toBeNull()
  })
})
