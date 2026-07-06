import { renderHook, act } from '@testing-library/react-native'
import { useMinDisplayTime } from '@/hooks/useMinDisplayTime'

describe('useMinDisplayTime', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('is gated while !isReady and timer is still pending', async () => {
    const { result } = await renderHook(() => useMinDisplayTime(false, 1200, 'a'))
    expect(result.current).toBe(true)
  })

  it('stays gated when timer fires but isReady is still false', async () => {
    const { result } = await renderHook(() => useMinDisplayTime(false, 1200, 'a'))
    act(() => {
      jest.advanceTimersByTime(1200)
    })
    expect(result.current).toBe(true)
  })

  it('stays gated when isReady is true but timer is still pending', async () => {
    const { result } = await renderHook(() => useMinDisplayTime(true, 1200, 'a'))
    act(() => {
      jest.advanceTimersByTime(500)
    })
    expect(result.current).toBe(true)
  })

  it('releases when both isReady and timer have fired', async () => {
    const { result, rerender } = await renderHook(
      ({ isReady }: { isReady: boolean }) => useMinDisplayTime(isReady, 1200, 'a'),
      { initialProps: { isReady: false } },
    )
    act(() => {
      jest.advanceTimersByTime(1200)
    })
    expect(result.current).toBe(true)
    rerender({ isReady: true })
    expect(result.current).toBe(false)
  })

  it('re-gates and restarts the timer when resetKey changes', async () => {
    const { result, rerender } = await renderHook(
      ({ resetKey }: { resetKey: string }) => useMinDisplayTime(true, 1200, resetKey),
      { initialProps: { resetKey: 'a' } },
    )
    act(() => {
      jest.advanceTimersByTime(1200)
    })
    expect(result.current).toBe(false)

    rerender({ resetKey: 'b' })
    expect(result.current).toBe(true)

    act(() => {
      jest.advanceTimersByTime(1199)
    })
    expect(result.current).toBe(true)

    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(result.current).toBe(false)
  })

  it('with minMs <= 0 releases immediately on isReady=true and schedules no timer', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout')
    const { result, rerender } = await renderHook(
      ({ isReady }: { isReady: boolean }) => useMinDisplayTime(isReady, 0, 'a'),
      { initialProps: { isReady: false } },
    )
    expect(result.current).toBe(true)
    rerender({ isReady: true })
    expect(result.current).toBe(false)
    expect(setTimeoutSpy).not.toHaveBeenCalled()
    setTimeoutSpy.mockRestore()
  })

  it('clears the pending timer on unmount', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')
    const { unmount } = await renderHook(() => useMinDisplayTime(false, 1200, 'a'))
    unmount()
    expect(clearTimeoutSpy).toHaveBeenCalled()
    clearTimeoutSpy.mockRestore()
  })
})
