import { act } from '@testing-library/react-native'
import { useNavLockStore } from '@/stores/navLock'

describe('navLock store', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    act(() => {
      useNavLockStore.getState().clear()
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('starts idle', () => {
    expect(useNavLockStore.getState().isNavigating).toBe(false)
  })

  it('lock sets isNavigating true', () => {
    act(() => {
      useNavLockStore.getState().lock()
    })
    expect(useNavLockStore.getState().isNavigating).toBe(true)
  })

  it('clear sets isNavigating false', () => {
    act(() => {
      useNavLockStore.getState().lock()
      useNavLockStore.getState().clear()
    })
    expect(useNavLockStore.getState().isNavigating).toBe(false)
  })

  it('auto-clears after the timeout if never cleared manually', () => {
    act(() => {
      useNavLockStore.getState().lock()
    })
    expect(useNavLockStore.getState().isNavigating).toBe(true)

    act(() => {
      jest.advanceTimersByTime(2000)
    })
    expect(useNavLockStore.getState().isNavigating).toBe(false)
  })

  it('a manual clear cancels the pending auto-clear timeout', () => {
    act(() => {
      useNavLockStore.getState().lock()
      useNavLockStore.getState().clear()
      useNavLockStore.getState().lock()
    })
    // second lock() should start a fresh timer, not be cancelled by the
    // clearTimeout scheduled for the first lock()
    act(() => {
      jest.advanceTimersByTime(2000)
    })
    expect(useNavLockStore.getState().isNavigating).toBe(false)
  })
})
