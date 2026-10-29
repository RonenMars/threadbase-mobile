import {
  isSubagentPageSupported,
  isAllSubagentsPageSupported,
  groupSubagentsByParent,
  isSubagentRow,
  resolveSubagentLabel,
  resolveSubagentType,
} from '@/lib/subagents'
import type { Conversation } from '@/types/api'

function row(over: Partial<Conversation> = {}): Conversation {
  return {
    id: 'c1',
    title: 'Derived title',
    projectPath: '/p',
    messageCount: 3,
    lastActivity: '2026-10-24T10:00:00Z',
    ...over,
  }
}

describe('resolveSubagentLabel', () => {
  it('prefers description, then name, then the derived title', () => {
    expect(resolveSubagentLabel(row({ subagentDescription: 'Fix tests', subagentName: 'fixer' }))).toBe('Fix tests')
    expect(resolveSubagentLabel(row({ subagentName: 'fixer' }))).toBe('fixer')
    expect(resolveSubagentLabel(row())).toBe('Derived title')
  })

  it('treats blank strings and non-strings as absent (codex/cursor rows, no sidecar)', () => {
    expect(resolveSubagentLabel(row({ subagentDescription: '  ', subagentName: 'n' }))).toBe('n')
    expect(resolveSubagentLabel(row({ subagentDescription: 5 as never }))).toBe('Derived title')
  })
})

describe('resolveSubagentType', () => {
  it('returns the tag only when present', () => {
    expect(resolveSubagentType(row({ subagentType: 'Explore' }))).toBe('Explore')
    expect(resolveSubagentType(row())).toBeUndefined()
  })
})

describe('isSubagentPageSupported', () => {
  const child = (parent: string) => row({ isSubagent: true, parentConversationId: parent })

  it('accepts a page made only of the parent’s sub-agents, including an empty one', () => {
    expect(isSubagentPageSupported([child('p1'), child('p1')], 'p1')).toBe(true)
    expect(isSubagentPageSupported([], 'p1')).toBe(true)
  })

  it('rejects the unfiltered list an older streamer returns', () => {
    expect(isSubagentPageSupported([row(), row()], 'p1')).toBe(false)
  })

  it('rejects a page where any row belongs to another parent or is not a sub-agent', () => {
    expect(isSubagentPageSupported([child('p1'), child('p2')], 'p1')).toBe(false)
    expect(isSubagentPageSupported([child('p1'), row()], 'p1')).toBe(false)
  })
})

describe('isSubagentRow', () => {
  it('is true for the flag or a parent link, false for a top-level row', () => {
    expect(isSubagentRow({ isSubagent: true })).toBe(true)
    expect(isSubagentRow({ parentConversationId: 'p1' })).toBe(true)
    expect(isSubagentRow({})).toBe(false)
    expect(isSubagentRow({ parentConversationId: null })).toBe(false)
  })
})

describe('isAllSubagentsPageSupported', () => {
  const sub = (parent: string) => row({ isSubagent: true, parentConversationId: parent })

  it('accepts a page of only sub-agents, even from different parents', () => {
    expect(isAllSubagentsPageSupported([sub('p1'), sub('p2')])).toBe(true)
    expect(isAllSubagentsPageSupported([])).toBe(true)
  })

  it('rejects the normal list an older streamer returns', () => {
    expect(isAllSubagentsPageSupported([row(), sub('p1')])).toBe(false)
  })

  it('still accepts a page with a sub-agent the server has no parent for', () => {
    expect(isAllSubagentsPageSupported([sub('p1'), row({ isSubagent: true })])).toBe(true)
  })
})

describe('groupSubagentsByParent', () => {
  const sub = (id: string, parent: string, at: string, active = false) =>
    row({ id, isSubagent: true, parentConversationId: parent, lastActivity: at, subagentActive: active })

  it('groups by parent, newest group first, newest child first, counting active ones', () => {
    const groups = groupSubagentsByParent([
      sub('a', 'p1', '2026-10-24T10:00:00Z', true),
      sub('b', 'p2', '2026-10-24T12:00:00Z'),
      sub('c', 'p1', '2026-10-24T11:00:00Z', true),
    ])
    expect(groups.map((g) => g.parentId)).toEqual(['p2', 'p1'])
    expect(groups[1].items.map((i) => i.id)).toEqual(['c', 'a'])
    expect(groups[1].activeCount).toBe(2)
    expect(groups[0].activeCount).toBe(0)
  })
})
