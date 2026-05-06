import { shouldPersistQuery } from '@/services/query-client'

function q(queryKey: readonly unknown[], meta?: unknown) {
  return { queryKey, meta }
}

describe('shouldPersistQuery (persistence allow-list)', () => {
  it('allows projectChats per-server queries', () => {
    expect(shouldPersistQuery(q(['projectChats', 'srv1']))).toBe(true)
  })

  it('allows the projectChats-all multi-server roll-up', () => {
    expect(shouldPersistQuery(q(['projectChats-all', 'srv1']))).toBe(true)
  })

  it('allows session/conversation/project/serverInfo lightweight metadata', () => {
    expect(shouldPersistQuery(q(['session', 'srv1', 's1']))).toBe(true)
    expect(shouldPersistQuery(q(['conversation', 'srv1', 'c1']))).toBe(true)
    expect(shouldPersistQuery(q(['project', 'srv1', 'p1']))).toBe(true)
    expect(shouldPersistQuery(q(['serverInfo', 'srv1']))).toBe(true)
  })

  it('does NOT persist sessionMessages by default', () => {
    expect(shouldPersistQuery(q(['sessionMessages', 'srv1', 's1']))).toBe(false)
  })

  it('does NOT persist arbitrary unlisted query roots', () => {
    expect(shouldPersistQuery(q(['browse', 'srv1', '/some/path']))).toBe(false)
    expect(shouldPersistQuery(q(['random-thing']))).toBe(false)
  })

  it('respects an explicit meta.persist=false override on an allowed query', () => {
    expect(shouldPersistQuery(q(['session', 'srv1', 's1'], { persist: false }))).toBe(false)
  })
})
