import { useBannerStore, type BannerEntry } from '@/stores/banners'

beforeEach(() => {
  useBannerStore.getState().reset()
})

// AlertSpec pairs buttonText with buttonAction in a union arm, so the button
// has to be supplied as a literal rather than spread in from a Partial.
type BannerBase = Omit<BannerEntry, 'buttonText' | 'buttonAction' | 'buttonVariant'>

function spec(overrides: Partial<BannerBase> = {}): BannerEntry {
  return {
    id: 'query-error',
    level: 'error' as const,
    title: 'Sessions failed to load (1 of 2)',
    message: 'Sessions refused to load. Worth a retry.',
    ...overrides,
  }
}

describe('useBannerStore', () => {
  it('appends a new banner and dismisses it by id', () => {
    useBannerStore.getState().upsert(spec())
    expect(useBannerStore.getState().banners).toHaveLength(1)
    useBannerStore.getState().dismiss('query-error')
    expect(useBannerStore.getState().banners).toHaveLength(0)
  })

  it('replaces the stored entry when the copy changes', () => {
    useBannerStore.getState().upsert(spec())
    useBannerStore.getState().upsert(spec({ title: 'History failed to load' }))
    const { banners } = useBannerStore.getState()
    expect(banners).toHaveLength(1)
    expect(banners[0].title).toBe('History failed to load')
  })

  // BannerHost passes buttonAction down to Banner as a prop, so an upsert that
  // kept the stored object and only swapped the callback would leave Banner
  // holding the closure it captured last render — a Retry that retries an error
  // already gone from the list.
  it('hands out a new array identity when only the callbacks change', () => {
    const first = jest.fn()
    const second = jest.fn()
    useBannerStore.getState().upsert({ ...spec(), buttonText: 'Retry', buttonAction: first })
    const before = useBannerStore.getState().banners

    useBannerStore.getState().upsert({ ...spec(), buttonText: 'Retry', buttonAction: second })
    const after = useBannerStore.getState().banners

    expect(after).not.toBe(before)
    after[0].buttonAction?.()
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()
  })

  it('dismiss is a no-op for an id that is not showing', () => {
    useBannerStore.getState().upsert(spec())
    const before = useBannerStore.getState().banners
    useBannerStore.getState().dismiss('nope')
    expect(useBannerStore.getState().banners).toBe(before)
  })
})
