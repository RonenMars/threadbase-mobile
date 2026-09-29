import {
  buildShelfEntries,
  countNeedsYou,
  formatBadgeCount,
  indexShelfCache,
  openSavedItem,
  shelfTarget,
  snapSide,
} from '@/lib/savedShelf'
import { useNavLockStore } from '@/stores/navLock'
import type { FavoriteItem } from '@/stores/quickAccess'
import type { MultiConversation, MultiSession } from '@/types/api'

function session(id: string, status: string, serverId = 'srv'): MultiSession {
  return { id, serverId, status, ptyAttached: true, ownership: 'managed', projectName: 'p' } as MultiSession
}

const waiting = session('s-wait', 'waiting_input')
const running = session('s-run', 'running')

const favorites: FavoriteItem[] = [
  { type: 'dir', id: '~/code', label: '~/code' },
  { type: 'session', id: 'srv::session::s-run', label: 'Running', serverId: 'srv', sessionId: 's-run' },
  { type: 'conversation', id: 'srv::conversation::c1', label: 'Conv', serverId: 'srv', conversationId: 'c1' },
  // Pre-migration id with no sessionId field.
  { type: 'session', id: 'srv::s-wait', label: 'Waiting', serverId: 'srv' },
  { type: 'project-chat', id: 'srv::project-chat::session::s-gone', label: 'Gone', serverId: 'srv', chatType: 'session', chatId: 's-gone', projectId: 'p1' },
]

describe('shelfTarget', () => {
  it('reads the session id from sessionId, else the last id part', () => {
    expect(shelfTarget({ type: 'session', id: 'srv::session::a', label: '', serverId: 'srv', sessionId: 'b' }).id).toBe('b')
    expect(shelfTarget({ type: 'session', id: 'srv::session::a', label: '', serverId: 'srv' }).id).toBe('a')
    expect(shelfTarget({ type: 'session', id: 'srv::a', label: '', serverId: 'srv' }).id).toBe('a')
  })

  it('maps a project chat to its chat kind', () => {
    expect(
      shelfTarget({ type: 'project-chat', id: 'x', label: '', serverId: 'srv', chatType: 'conversation', chatId: 'c9', projectId: 'p' }),
    ).toEqual({ kind: 'conversation', serverId: 'srv', id: 'c9' })
  })
})

describe('buildShelfEntries / countNeedsYou', () => {
  const conversations = [{ id: 'c1', serverId: 'srv', title: 'Conv', provider: 'codex-cli' } as MultiConversation]
  const entries = buildShelfEntries(favorites, indexShelfCache([waiting, running], conversations))

  it('drops dir favorites and moves saved chats that need the user first', () => {
    expect(entries.map((e) => e.favorite.label)).toEqual(['Waiting', 'Running', 'Conv', 'Gone'])
  })

  it('counts only saved sessions in the needsYou tier', () => {
    expect(countNeedsYou(entries)).toBe(1)
  })

  it('does not count a session on another server with the same id', () => {
    const other = buildShelfEntries(favorites, indexShelfCache([session('s-wait', 'waiting_input', 'other')], []))
    expect(countNeedsYou(other)).toBe(0)
  })

  it('counts a running session gated on an open prompt as needing the user', () => {
    const gated: MultiSession = { ...session('s-run', 'running'), hasOpenPrompt: true }
    const withGate = buildShelfEntries(favorites, indexShelfCache([gated], conversations))
    expect(countNeedsYou(withGate)).toBe(1)
  })

  it('takes the provider from the cached row', () => {
    expect(entries.find((e) => e.favorite.label === 'Conv')?.provider).toBe('codex-cli')
    expect(entries.find((e) => e.favorite.label === 'Gone')?.provider).toBeUndefined()
  })
})

describe('formatBadgeCount', () => {
  it.each([
    [0, ''],
    [1, '1'],
    [99, '99'],
    [100, '99+'],
  ])('%i → %p', (n, out) => {
    expect(formatBadgeCount(n)).toBe(out)
  })
})

describe('openSavedItem', () => {
  beforeEach(() => useNavLockStore.getState().clear())
  afterEach(() => useNavLockStore.getState().clear())

  it('opens a conversation through conversationHref without locking', () => {
    const push = jest.fn()
    openSavedItem({ kind: 'conversation', serverId: 'srv', id: 'c1' }, { push })
    expect(push).toHaveBeenCalledWith('/conversation/c1?server=srv')
    expect(useNavLockStore.getState().isNavigating).toBe(false)
  })

  it('locks navigation, then pushes the session route', () => {
    const push = jest.fn(() => expect(useNavLockStore.getState().isNavigating).toBe(true))
    openSavedItem({ kind: 'session', serverId: 'srv', id: 's1' }, { push })
    expect(push).toHaveBeenCalledWith('/session/s1?server=srv')
  })
})

describe('snapSide', () => {
  it('settles on the half the bubble is released in when it is still', () => {
    expect(snapSide(100, 0, 400)).toBe('left')
    expect(snapSide(300, 0, 400)).toBe('right')
  })

  it('sends a bubble dropped dead centre to the right', () => {
    expect(snapSide(200, 0, 400)).toBe('right')
  })

  it('follows a flick across the middle', () => {
    expect(snapSide(150, 1000, 400)).toBe('right')
    expect(snapSide(250, -1000, 400)).toBe('left')
  })

  it('ignores a drift too slow to cross the middle', () => {
    expect(snapSide(150, 100, 400)).toBe('left')
  })
})
