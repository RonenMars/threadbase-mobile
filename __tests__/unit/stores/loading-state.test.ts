import { useLoadingStateStore } from '@/stores/loading-state'

describe('loading-state error queue', () => {
  beforeEach(() => {
    useLoadingStateStore.setState({ errors: [], dismissed: [] })
  })

  it('collapses repeated failures of one category into a single entry', () => {
    const { pushError } = useLoadingStateStore.getState()
    for (let i = 0; i < 24; i++) pushError({ category: 'messages', message: `boom ${i}` })

    const { errors } = useLoadingStateStore.getState()
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe('boom 23')
  })

  it('keeps one entry per distinct category and dismisses by id', () => {
    const { pushError } = useLoadingStateStore.getState()
    pushError({ category: 'messages', message: 'a' })
    pushError({ category: 'sessions', message: 'b' })
    pushError({ category: 'messages', message: 'c' })

    expect(useLoadingStateStore.getState().errors.map((e) => e.category)).toEqual([
      'messages',
      'sessions',
    ])

    useLoadingStateStore.getState().dismissError('messages')
    expect(useLoadingStateStore.getState().errors).toHaveLength(1)
  })

  it('keeps a closed category closed when the same failure re-pushes', () => {
    const { pushError } = useLoadingStateStore.getState()
    pushError({ category: 'messages', message: 'boom' })

    // Closing the banner, not retrying.
    useLoadingStateStore.getState().dismissError('messages', true)
    // What returning from the background does: refetch, fail, push again.
    pushError({ category: 'messages', message: 'boom' })

    expect(useLoadingStateStore.getState().errors).toHaveLength(0)
  })

  it('still reports other categories while one is suppressed', () => {
    const { pushError } = useLoadingStateStore.getState()
    pushError({ category: 'messages', message: 'boom' })
    useLoadingStateStore.getState().dismissError('messages', true)

    pushError({ category: 'sessions', message: 'other' })

    expect(useLoadingStateStore.getState().errors.map((e) => e.category)).toEqual(['sessions'])
  })

  it('re-arms a suppressed category once it succeeds again', () => {
    const { pushError } = useLoadingStateStore.getState()
    pushError({ category: 'messages', message: 'boom' })
    useLoadingStateStore.getState().dismissError('messages', true)

    useLoadingStateStore.getState().clearDismissed('messages')
    pushError({ category: 'messages', message: 'boom again' })

    expect(useLoadingStateStore.getState().errors).toHaveLength(1)
  })

  // A healed failure used to keep its row until the user closed it, and the
  // sheet is global, so it followed them onto screens that were fine.
  it('retires a category row once that category succeeds', () => {
    const { pushError } = useLoadingStateStore.getState()
    pushError({ category: 'other', message: 'boom' })
    pushError({ category: 'sessions', message: 'still broken' })

    useLoadingStateStore.getState().resolveError('other')

    const { errors } = useLoadingStateStore.getState()
    expect(errors.map((e) => e.category)).toEqual(['sessions'])
  })

  it('leaves a user-closed category suppressed after a later success', () => {
    const { pushError } = useLoadingStateStore.getState()
    pushError({ category: 'messages', message: 'boom' })
    useLoadingStateStore.getState().dismissError('messages', true)

    // Recovery drops any row and re-arms the category; the next genuine
    // failure must show again rather than staying silently suppressed.
    useLoadingStateStore.getState().resolveError('messages')
    expect(useLoadingStateStore.getState().errors).toHaveLength(0)

    useLoadingStateStore.getState().clearDismissed('messages')
    pushError({ category: 'messages', message: 'boom again' })
    expect(useLoadingStateStore.getState().errors).toHaveLength(1)
  })

  it('is a no-op for a category with no row', () => {
    const { pushError } = useLoadingStateStore.getState()
    pushError({ category: 'sessions', message: 'boom' })
    const before = useLoadingStateStore.getState().errors

    useLoadingStateStore.getState().resolveError('conversations')

    // Same array identity: every settled query calls this, so a miss must not
    // churn subscribers.
    expect(useLoadingStateStore.getState().errors).toBe(before)
  })

  it('does not suppress on a retry dismissal', () => {
    const { pushError } = useLoadingStateStore.getState()
    pushError({ category: 'messages', message: 'boom' })

    // Retry clears the entry without sticking, so a failed retry re-shows.
    useLoadingStateStore.getState().dismissError('messages')
    pushError({ category: 'messages', message: 'boom' })

    expect(useLoadingStateStore.getState().errors).toHaveLength(1)
  })
})
