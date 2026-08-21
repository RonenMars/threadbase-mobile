/**
 * The two things in this design that own resources: the ghost's expiry timer
 * and the AppState resume listener.
 *
 * Neither decides anything — both only prompt expireIfStale() to re-evaluate
 * against the stamp. But a timer armed once per mount, or one left running past
 * the ghost it was armed for, or a listener that outlives the screen, are all
 * failures that show up long after the code that caused them.
 *
 * One asymmetry worth knowing, because it looks like a coverage gap and is not.
 * Removing `clearTimeout` from the cleanup breaks nothing here, and cannot: a
 * leaked timer fires expireIfStale(), which is stamp-guarded, so it finds the
 * newer ghost too young and no-ops. That is the design working — a prompt can
 * be early, late or spurious without being wrong. The cleanup stays because
 * firing against a dead component is still wrong to leave lying around, but no
 * test can observe its absence, and one written to would be testing the
 * implementation rather than the behaviour.
 *
 * The AppState listener is the opposite: leaking it IS observable, and is
 * asserted below.
 */
import { renderHook, act } from '@testing-library/react-native'
import { AppState } from 'react-native'
import { useActiveQuestion, GHOST_TTL_MS } from '@/hooks/useActiveQuestion'
import type { PermissionWsMessage } from '@/types/api'

type ClientHandler = (msg: unknown) => void

jest.mock('@/services/ws-client', () => {
  const clientListeners = new Map<string, Set<ClientHandler>>()
  return {
    wsManager: {
      getClient: () => ({
        on: (type: string, handler: ClientHandler) => {
          if (!clientListeners.has(type)) clientListeners.set(type, new Set())
          clientListeners.get(type)!.add(handler)
          return () => clientListeners.get(type)!.delete(handler)
        },
      }),
      onAnyStatusChange: () => () => {},
    },
    __wsTest: {
      emit: (type: string, msg: unknown) => clientListeners.get(type)?.forEach((l) => l(msg)),
    },
  }
})

const { __wsTest } = jest.requireMock('@/services/ws-client') as {
  __wsTest: { emit: (type: string, msg: unknown) => void }
}

const gate: PermissionWsMessage = {
  type: 'permission',
  sessionId: 's1',
  prompt: 'Do you want to proceed?',
  detail: 'Bash command',
  options: [{ index: 1, label: 'Yes' }, { index: 2, label: 'No' }],
}

beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(new Date('2026-08-21T00:00:00.000Z').getTime())
})
afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

describe('ghost expiry — timer lifecycle', () => {
  // Armed on the transition into pending, not on mount. A hook that armed once
  // would hand a ghost created twenty minutes into a session a timer that fired
  // long ago, leaving the resume path as its only exit.
  it('arms the expiry for a ghost created long after mount', async () => {
    const { result } = await renderHook(() => useActiveQuestion('srv-1', 's1'))

    await act(() => { jest.advanceTimersByTime(20 * 60 * 1000) })

    await act(() => __wsTest.emit('permission', gate))
    await act(() => result.current.markPending(result.current.questionKey))
    expect(result.current.phase).toBe('pending')

    await act(() => { jest.advanceTimersByTime(GHOST_TTL_MS) })
    expect(result.current.question).toBeNull()
  })

  // A ghost that leaves by cancellation must take its timer with it. Otherwise
  // the stale timer fires against whatever is on screen later — here, a second
  // ghost that has only been standing two seconds and is not due to expire.
  //
  // Asserted by consequence rather than by counting live timers: the RN test
  // environment runs timers of its own, so a count would be measuring the
  // harness. This is the thing a leaked timer would actually do.
  it('does not let a retired ghost timer expire a later one early', async () => {
    const { result } = await renderHook(() => useActiveQuestion('srv-1', 's1'))

    await act(() => __wsTest.emit('permission', gate))
    await act(() => result.current.markPending(result.current.questionKey))
    await act(() => __wsTest.emit('permission_cancelled', { type: 'permission_cancelled', sessionId: 's1' }))

    await act(() => { jest.advanceTimersByTime(2000) })
    await act(() => __wsTest.emit('permission', { ...gate, detail: 'Edit file' }))
    await act(() => result.current.markPending(result.current.questionKey))

    // The first ghost's timer would fire here. The second is 2s younger.
    await act(() => { jest.advanceTimersByTime(GHOST_TTL_MS - 2000) })
    expect(result.current.phase).toBe('pending')

    await act(() => { jest.advanceTimersByTime(2000) })
    expect(result.current.question).toBeNull()
  })

})

describe('ghost expiry — AppState listener lifecycle', () => {
  // The backgrounded case a timer alone gets wrong: it fires late, or not at
  // all. Resuming re-evaluates against the stamp, which is why a late prompt
  // still reaches the right answer.
  it('expires a ghost on resume when the timer never got the chance', async () => {
    const listeners: ((s: string) => void)[] = []
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
      listeners.push(handler as (s: string) => void)
      return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>
    })

    const { result } = await renderHook(() => useActiveQuestion('srv-1', 's1'))
    await act(() => __wsTest.emit('permission', gate))
    await act(() => result.current.markPending(result.current.questionKey))

    // Wall clock moves without the timer being given a chance to run, which is
    // what a suspended app looks like from here.
    jest.setSystemTime(Date.now() + 20 * 60 * 1000)
    await act(() => { listeners.forEach((l) => l('active')) })

    expect(result.current.question).toBeNull()
  })

  it('does not expire a ghost that resumes while still inside its ttl', async () => {
    const listeners: ((s: string) => void)[] = []
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
      listeners.push(handler as (s: string) => void)
      return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>
    })

    const { result } = await renderHook(() => useActiveQuestion('srv-1', 's1'))
    await act(() => __wsTest.emit('permission', gate))
    await act(() => result.current.markPending(result.current.questionKey))

    jest.setSystemTime(Date.now() + GHOST_TTL_MS - 1)
    await act(() => { listeners.forEach((l) => l('active')) })

    expect(result.current.phase).toBe('pending')
  })

  // Navigating between sessions mounts and unmounts this hook repeatedly. A
  // listener left behind on each visit accumulates in silence.
  it('removes the listener when the screen goes away', async () => {
    const remove = jest.fn()
    jest.spyOn(AppState, 'addEventListener').mockReturnValue(
      { remove } as unknown as ReturnType<typeof AppState.addEventListener>,
    )

    const { result, unmount } = await renderHook(() => useActiveQuestion('srv-1', 's1'))
    await act(() => __wsTest.emit('permission', gate))
    await act(() => result.current.markPending(result.current.questionKey))

    expect(remove).not.toHaveBeenCalled()
    await act(() => { unmount() })
    expect(remove).toHaveBeenCalled()
  })

  // Also a delta — other things in the environment subscribe to AppState, so an
  // absolute count would be measuring them.
  it('subscribes only while a ghost is standing', async () => {
    const remove = jest.fn()
    const addEventListener = jest
      .spyOn(AppState, 'addEventListener')
      .mockReturnValue({ remove } as unknown as ReturnType<typeof AppState.addEventListener>)

    const { result } = await renderHook(() => useActiveQuestion('srv-1', 's1'))
    const baseline = addEventListener.mock.calls.length

    await act(() => __wsTest.emit('permission', gate))
    expect(result.current.phase).toBe('active')
    expect(addEventListener.mock.calls.length).toBe(baseline)

    await act(() => result.current.markPending(result.current.questionKey))
    expect(addEventListener.mock.calls.length).toBe(baseline + 1)

    await act(() => __wsTest.emit('permission_cancelled', { type: 'permission_cancelled', sessionId: 's1' }))
    expect(remove).toHaveBeenCalled()
  })
})
