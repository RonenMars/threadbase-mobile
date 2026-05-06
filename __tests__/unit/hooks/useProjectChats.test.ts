import { QueryClient } from '@tanstack/react-query'
import {
  dedupeProjectChats,
  getProjectChatBadge,
  invalidateProjectChats,
  projectChatKey,
  projectChatKeys,
  sortProjectChats,
} from '@/hooks/useProjectChats'
import type {
  ProjectChat,
  ProjectChatConversation,
  ProjectChatSession,
} from '@/types/projectChat'

function session(over: Partial<ProjectChatSession> = {}): ProjectChatSession {
  return {
    type: 'session',
    id: 's1',
    projectId: 'p1',
    projectPath: '/foo',
    title: 'Session 1',
    latestMessageAt: '2026-05-06T10:00:00Z',
    status: 'active',
    source: 'session-store',
    serverId: 'srv1',
    ...over,
  }
}

function conversation(over: Partial<ProjectChatConversation> = {}): ProjectChatConversation {
  return {
    type: 'conversation',
    id: 'c1',
    projectId: 'p1',
    projectPath: '/foo',
    title: 'Conversation 1',
    latestMessageAt: '2026-05-06T09:00:00Z',
    status: 'resumable',
    source: 'hdd-cache',
    serverId: 'srv1',
    ...over,
  }
}

describe('projectChatKeys', () => {
  it('produces serverId-scoped keys', () => {
    expect(projectChatKeys.list('srv1')).toEqual(['projectChats', 'srv1'])
    expect(projectChatKeys.detail('srv1', 'session', 's1')).toEqual([
      'projectChats',
      'srv1',
      'session',
      's1',
    ])
  })
})

describe('projectChatKey', () => {
  it('uses type:id format scoped by serverId', () => {
    const s = session({ id: 's1', serverId: 'srv1' })
    expect(projectChatKey(s)).toBe('srv1::session:s1')

    const c = conversation({ id: 'c1', serverId: 'srv2' })
    expect(projectChatKey(c)).toBe('srv2::conversation:c1')
  })

  it('does not use projectPath in the key', () => {
    const s = session({ id: 's1', projectPath: '/some/very/long/path' })
    expect(projectChatKey(s)).not.toContain('/some/very/long/path')
  })
})

describe('sortProjectChats', () => {
  it('sorts by latestMessageAt desc, then title asc as tiebreaker', () => {
    const items: ProjectChat[] = [
      session({ id: 'a', latestMessageAt: '2026-05-01T00:00:00Z', title: 'B' }),
      session({ id: 'b', latestMessageAt: '2026-05-06T00:00:00Z', title: 'A' }),
      session({ id: 'c', latestMessageAt: '2026-05-06T00:00:00Z', title: 'B' }),
    ]
    items.sort(sortProjectChats)
    expect(items.map((i) => i.id)).toEqual(['b', 'c', 'a'])
  })

  it('falls back to updatedAt then createdAt when latestMessageAt missing', () => {
    const a = session({ id: 'a', latestMessageAt: null, updatedAt: '2026-05-02T00:00:00Z' })
    const b = session({ id: 'b', latestMessageAt: null, updatedAt: '2026-05-04T00:00:00Z' })
    const sorted = [a, b].sort(sortProjectChats)
    expect(sorted[0].id).toBe('b')
  })
})

describe('dedupeProjectChats', () => {
  it('hides a conversation that has been resumed by a session in the list', () => {
    const items: ProjectChat[] = [
      session({ id: 's1', resumedFromConversationId: 'c1' }),
      conversation({ id: 'c1' }),
      conversation({ id: 'c2' }),
    ]
    const deduped = dedupeProjectChats(items)
    expect(deduped.map((i) => i.id)).toEqual(['s1', 'c2'])
  })

  it('keeps all sessions even when many', () => {
    const items: ProjectChat[] = [
      session({ id: 's1', resumedFromConversationId: 'c1' }),
      session({ id: 's2' }),
      conversation({ id: 'c1' }),
    ]
    expect(dedupeProjectChats(items).filter((i) => i.type === 'session')).toHaveLength(2)
  })
})

describe('getProjectChatBadge', () => {
  it('labels sessions as Active', () => {
    expect(getProjectChatBadge(session())).toBe('Active')
  })
  it('labels resumable conversations as Resumable', () => {
    expect(getProjectChatBadge(conversation({ status: 'resumable' }))).toBe('Resumable')
  })
  it('labels archived conversations as Archived', () => {
    expect(getProjectChatBadge(conversation({ status: 'archived' }))).toBe('Archived')
  })
})

describe('invalidateProjectChats', () => {
  it('invalidates the per-server list when serverId is provided', () => {
    const qc = new QueryClient()
    const spy = jest.spyOn(qc, 'invalidateQueries')
    invalidateProjectChats(qc, 'srv1')
    expect(spy).toHaveBeenCalledWith({ queryKey: projectChatKeys.list('srv1') })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['projectChats-all'], exact: false })
  })

  it('still invalidates the multi-server roll-up when no serverId is given', () => {
    const qc = new QueryClient()
    const spy = jest.spyOn(qc, 'invalidateQueries')
    invalidateProjectChats(qc)
    expect(spy).toHaveBeenCalledWith({ queryKey: ['projectChats-all'], exact: false })
  })
})
