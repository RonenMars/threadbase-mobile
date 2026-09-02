import { useLoadingStateStore } from '@/stores/loading-state'

describe('loading-state error queue', () => {
  beforeEach(() => {
    useLoadingStateStore.setState({ errors: [] })
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
})
