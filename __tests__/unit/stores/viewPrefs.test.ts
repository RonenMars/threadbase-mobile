import AsyncStorage from '@react-native-async-storage/async-storage'
import { useViewPrefsStore } from '@/stores/viewPrefs'

beforeEach(() => {
  useViewPrefsStore.setState({
    collapsedServers: [],
    recentsOpen: true,
    classicSessionsCollapsed: null,
  })
  ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(null)
})

describe('ViewPrefsStore – server collapse', () => {
  it('toggle adds then removes a server id', () => {
    const { toggleServerCollapsed } = useViewPrefsStore.getState()
    toggleServerCollapsed('srv1')
    expect(useViewPrefsStore.getState().collapsedServers).toEqual(['srv1'])
    toggleServerCollapsed('srv1')
    expect(useViewPrefsStore.getState().collapsedServers).toEqual([])
  })

  it('tracks multiple servers independently', () => {
    const { toggleServerCollapsed } = useViewPrefsStore.getState()
    toggleServerCollapsed('srv1')
    toggleServerCollapsed('srv2')
    expect(useViewPrefsStore.getState().collapsedServers.sort()).toEqual(['srv1', 'srv2'])
  })
})

describe('ViewPrefsStore – recents accordion', () => {
  it('defaults open and can be set closed', () => {
    expect(useViewPrefsStore.getState().recentsOpen).toBe(true)
    useViewPrefsStore.getState().setRecentsOpen(false)
    expect(useViewPrefsStore.getState().recentsOpen).toBe(false)
  })
})

describe('ViewPrefsStore – classic sessions header', () => {
  it('defaults to null (follow count-based default) and stores an explicit choice', () => {
    expect(useViewPrefsStore.getState().classicSessionsCollapsed).toBeNull()
    useViewPrefsStore.getState().setClassicSessionsCollapsed(true)
    expect(useViewPrefsStore.getState().classicSessionsCollapsed).toBe(true)
    useViewPrefsStore.getState().setClassicSessionsCollapsed(false)
    expect(useViewPrefsStore.getState().classicSessionsCollapsed).toBe(false)
  })
})

describe('ViewPrefsStore – hydrate', () => {
  it('merges persisted values', async () => {
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify({ collapsedServers: ['srv9'], recentsOpen: false, classicSessionsCollapsed: true }),
    )
    await useViewPrefsStore.getState().hydrate()
    expect(useViewPrefsStore.getState().collapsedServers).toEqual(['srv9'])
    expect(useViewPrefsStore.getState().recentsOpen).toBe(false)
    expect(useViewPrefsStore.getState().classicSessionsCollapsed).toBe(true)
  })

  it('ignores malformed collapsedServers, keeping defaults', async () => {
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify({ collapsedServers: 'not-an-array' }),
    )
    await useViewPrefsStore.getState().hydrate()
    expect(useViewPrefsStore.getState().collapsedServers).toEqual([])
    expect(useViewPrefsStore.getState().recentsOpen).toBe(true)
  })
})
