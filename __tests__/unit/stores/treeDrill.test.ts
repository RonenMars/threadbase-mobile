import { useTreeDrillStore } from '@/stores/treeDrill'

beforeEach(() => {
  useTreeDrillStore.setState({ current: null })
})

describe('useTreeDrillStore', () => {
  it('starts with no current drill target', () => {
    expect(useTreeDrillStore.getState().current).toBeNull()
  })

  it('setCurrent stores the { serverId, path } target', () => {
    useTreeDrillStore.getState().setCurrent({ serverId: 'srv-1', path: '/home/user/proj' })
    expect(useTreeDrillStore.getState().current).toEqual({
      serverId: 'srv-1',
      path: '/home/user/proj',
    })
  })

  it('setCurrent(null) clears the target', () => {
    useTreeDrillStore.getState().setCurrent({ serverId: 'srv-1', path: '/p' })
    useTreeDrillStore.getState().setCurrent(null)
    expect(useTreeDrillStore.getState().current).toBeNull()
  })

  it('clear() resets the target', () => {
    useTreeDrillStore.getState().setCurrent({ serverId: 'srv-1', path: '/p' })
    useTreeDrillStore.getState().clear()
    expect(useTreeDrillStore.getState().current).toBeNull()
  })

  it('overwriting setCurrent replaces the previous target', () => {
    useTreeDrillStore.getState().setCurrent({ serverId: 'srv-1', path: '/a' })
    useTreeDrillStore.getState().setCurrent({ serverId: 'srv-2', path: '/b' })
    expect(useTreeDrillStore.getState().current).toEqual({ serverId: 'srv-2', path: '/b' })
  })
})
