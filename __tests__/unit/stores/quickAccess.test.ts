import { useQuickAccessStore, buildFavoriteId } from '@/stores/quickAccess'

beforeEach(() => {
  useQuickAccessStore.setState({
    favorites: [],
    ignoredRecents: [],
    ignoredPopular: [],
    stripCollapsed: false,
    favoritesEnabled: true,
    recentsEnabled: true,
    popularEnabled: true,
  })
})

describe('QuickAccessStore – favorites', () => {
  it('starts empty', () => {
    expect(useQuickAccessStore.getState().favorites).toEqual([])
  })

  it('pinItem adds to favorites', () => {
    useQuickAccessStore.getState().pinItem({ type: 'dir', id: '~/my-app', label: '~/my-app' })
    expect(useQuickAccessStore.getState().favorites).toHaveLength(1)
    expect(useQuickAccessStore.getState().favorites[0].id).toBe('~/my-app')
  })

  it('pinItem is idempotent — does not duplicate', () => {
    const store = useQuickAccessStore.getState()
    store.pinItem({ type: 'dir', id: '~/my-app', label: '~/my-app' })
    store.pinItem({ type: 'dir', id: '~/my-app', label: '~/my-app' })
    expect(useQuickAccessStore.getState().favorites).toHaveLength(1)
  })

  it('unpinItem removes by id', () => {
    useQuickAccessStore.getState().pinItem({ type: 'dir', id: '~/my-app', label: '~/my-app' })
    useQuickAccessStore.getState().unpinItem('~/my-app')
    expect(useQuickAccessStore.getState().favorites).toHaveLength(0)
  })
})

describe('QuickAccessStore – ignored sets', () => {
  it('ignoreRecent adds to ignoredRecents', () => {
    useQuickAccessStore.getState().ignoreRecent('srv1::sess1')
    expect(useQuickAccessStore.getState().ignoredRecents).toContain('srv1::sess1')
  })

  it('ignorePopular adds to ignoredPopular', () => {
    useQuickAccessStore.getState().ignorePopular('~/my-app')
    expect(useQuickAccessStore.getState().ignoredPopular).toContain('~/my-app')
  })
})

describe('QuickAccessStore – tab toggles', () => {
  it('can disable recents', () => {
    useQuickAccessStore.getState().setRecentsEnabled(false)
    expect(useQuickAccessStore.getState().recentsEnabled).toBe(false)
  })

  it('defaults all tabs enabled', () => {
    const s = useQuickAccessStore.getState()
    expect(s.favoritesEnabled).toBe(true)
    expect(s.recentsEnabled).toBe(true)
    expect(s.popularEnabled).toBe(true)
  })
})

describe('QuickAccessStore – collapse', () => {
  it('toggles stripCollapsed', () => {
    useQuickAccessStore.getState().setStripCollapsed(true)
    expect(useQuickAccessStore.getState().stripCollapsed).toBe(true)
  })
})

describe('QuickAccessStore – buildFavoriteId (Step S6)', () => {
  it('produces ${serverId}::${type}::${id} for chat favorites', () => {
    expect(buildFavoriteId('srv1', 'session', 's1')).toBe('srv1::session::s1')
    expect(buildFavoriteId('srv1', 'conversation', 'c1')).toBe('srv1::conversation::c1')
  })

  it('does NOT include projectPath in the id', () => {
    expect(buildFavoriteId('srv1', 'session', 's1')).not.toContain('/')
  })

  it('supports project-chat compound shape', () => {
    expect(buildFavoriteId('srv1', 'project-chat', 'session', 's1')).toBe(
      'srv1::project-chat::session::s1',
    )
  })
})

describe('QuickAccessStore – new favorite types (Step S6)', () => {
  it('accepts a project-chat favorite shape', () => {
    useQuickAccessStore.getState().pinItem({
      type: 'project-chat',
      id: 'srv1::project-chat::session::s1',
      label: 'My Project',
      serverId: 'srv1',
      chatType: 'session',
      chatId: 's1',
      projectId: 'p1',
    })
    const fav = useQuickAccessStore.getState().favorites[0]
    expect(fav.type).toBe('project-chat')
    expect(fav).toMatchObject({ chatType: 'session', chatId: 's1', projectId: 'p1' })
  })

  it('accepts a conversation favorite shape', () => {
    useQuickAccessStore.getState().pinItem({
      type: 'conversation',
      id: 'srv1::conversation::c1',
      label: 'Old chat',
      serverId: 'srv1',
      conversationId: 'c1',
    })
    const fav = useQuickAccessStore.getState().favorites[0]
    expect(fav).toMatchObject({ type: 'conversation', conversationId: 'c1' })
  })
})
