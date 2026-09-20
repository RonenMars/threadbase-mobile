/**
 * Offset pagination over a live-updating list repeats rows: a conversation
 * whose last_updated_at moves while page 0 is on screen shifts across the
 * offset boundary and comes back in page 1. Concatenating the pages then
 * hands FlatList two children with the same key.
 */
import { dedupeByServerAndId } from '@/hooks/useConversations'
import type { MultiConversation } from '@/types/api'

const conv = (id: string, serverId: string): MultiConversation => ({
  id,
  title: id,
  projectPath: '/tmp/p',
  messageCount: 1,
  lastActivity: '2026-09-18T06:40:49.539Z',
  serverId,
})

it('drops a row that repeats across two pages', () => {
  const page0 = [conv('a', 'srv-1'), conv('b', 'srv-1')]
  const page1 = [conv('b', 'srv-1'), conv('c', 'srv-1')]
  const ids = dedupeByServerAndId([...page0, ...page1]).map((c) => `${c.serverId}::${c.id}`)
  expect(ids).toEqual(['srv-1::a', 'srv-1::b', 'srv-1::c'])
})

it('keeps the same conversation id on two different servers', () => {
  const ids = dedupeByServerAndId([conv('a', 'srv-1'), conv('a', 'srv-2')]).map((c) => c.serverId)
  expect(ids).toEqual(['srv-1', 'srv-2'])
})
