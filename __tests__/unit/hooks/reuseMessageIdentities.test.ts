import { reuseMessageIdentities } from '@/hooks/useConversations'
import type { Message } from '@/types/api'

function msg(id: string, text: string): Message {
  return {
    id,
    uuid: id,
    role: 'user',
    content: [{ type: 'text', text }],
    timestamp: '2026-07-23T00:00:00Z',
    is_sidechain: false,
    parent_uuid: null,
  }
}

describe('reuseMessageIdentities', () => {
  it('reuses prior objects for unchanged ids so references stay stable', () => {
    const prev = [msg('a', 'hi'), msg('b', 'there')]
    // Fresh rebuild: same content, brand-new object identities (what a drain produces).
    const next = [msg('a', 'hi'), msg('b', 'there')]
    const out = reuseMessageIdentities(prev, next)
    expect(out[0]).toBe(prev[0])
    expect(out[1]).toBe(prev[1])
  })

  it('keeps the new object when content changed', () => {
    const prev = [msg('a', 'hi')]
    const next = [msg('a', 'edited')]
    const out = reuseMessageIdentities(prev, next)
    expect(out[0]).toBe(next[0])
  })

  it('reuses existing rows and adds appended ones (the live-append case)', () => {
    const prev = [msg('a', 'hi')]
    const next = [msg('a', 'hi'), msg('b', 'new')]
    const out = reuseMessageIdentities(prev, next)
    expect(out[0]).toBe(prev[0]) // existing row keeps its reference
    expect(out[1]).toBe(next[1]) // appended row is the fresh object
  })

  it('returns the next array untouched when nothing was reusable (no false churn signal)', () => {
    const next = [msg('a', 'hi')]
    expect(reuseMessageIdentities([], next)).toBe(next)
  })
})
