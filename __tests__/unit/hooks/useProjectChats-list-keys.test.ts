import { dedupeProjectChats, projectChatKey } from '@/hooks/useProjectChats'
import type { ProjectChat } from '@/types/projectChat'

function build(over: Partial<ProjectChat>): ProjectChat {
  if (over.type === 'conversation') {
    return {
      type: 'conversation',
      id: 'c1',
      projectId: 'p1',
      projectPath: '/foo',
      title: 'Conv',
      latestMessageAt: '2026-05-06T08:00:00Z',
      status: 'resumable',
      source: 'hdd-cache',
      serverId: 'srv1',
      ...over,
    } as ProjectChat
  }
  return {
    type: 'session',
    id: 's1',
    projectId: 'p1',
    projectPath: '/foo',
    title: 'Sess',
    latestMessageAt: '2026-05-06T10:00:00Z',
    status: 'active',
    source: 'session-store',
    serverId: 'srv1',
    ...over,
  } as ProjectChat
}

describe('list rendering — keyExtractor format', () => {
  it('uses type:id format with serverId scope', () => {
    const session = build({ type: 'session', id: 's-abc', serverId: 'srv1' })
    expect(projectChatKey(session)).toBe('srv1::session:s-abc')

    const conv = build({ type: 'conversation', id: 'c-xyz', serverId: 'srv2' })
    expect(projectChatKey(conv)).toBe('srv2::conversation:c-xyz')
  })

  it('keys are unique across different (server, type, id) tuples', () => {
    const a = build({ type: 'session', id: 's1', serverId: 'srv1' })
    const b = build({ type: 'session', id: 's1', serverId: 'srv2' })
    const c = build({ type: 'conversation', id: 's1', serverId: 'srv1' })
    const keys = new Set([projectChatKey(a), projectChatKey(b), projectChatKey(c)])
    expect(keys.size).toBe(3)
  })

  it('does not include projectPath in the key', () => {
    const longPath = '/very/very/long/nested/path/foo'
    const session = build({ type: 'session', id: 's1', projectPath: longPath })
    expect(projectChatKey(session)).not.toContain('/very')
    expect(projectChatKey(session)).not.toContain(longPath)
  })
})

describe('defensive dedupe — resumed conversation hidden', () => {
  it('hides the conversation that a session has resumed from', () => {
    const items: ProjectChat[] = [
      build({ type: 'session', id: 'new-sess', resumedFromConversationId: 'old-conv' }),
      build({ type: 'conversation', id: 'old-conv' }),
      build({ type: 'conversation', id: 'other-conv' }),
    ]
    const out = dedupeProjectChats(items)
    expect(out.find((i) => i.id === 'old-conv')).toBeUndefined()
    expect(out.find((i) => i.id === 'other-conv')).toBeDefined()
    expect(out.find((i) => i.id === 'new-sess')).toBeDefined()
  })
})
