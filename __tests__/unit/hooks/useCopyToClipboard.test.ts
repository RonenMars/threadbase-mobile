import { act, renderHook } from '@testing-library/react-native'
import * as Clipboard from 'expo-clipboard'
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'

const setString = Clipboard.setStringAsync as jest.Mock
// Unique delay so the hook's timers can be told apart from timers the test renderer schedules.
const MS = 1234

describe('useCopyToClipboard', () => {
  let setSpy: jest.SpyInstance
  let clearSpy: jest.SpyInstance
  const hookTimers = () =>
    setSpy.mock.results.filter((_, i) => setSpy.mock.calls[i][1] === MS).map((r) => r.value)

  beforeEach(() => {
    jest.useFakeTimers()
    setSpy = jest.spyOn(global, 'setTimeout')
    clearSpy = jest.spyOn(global, 'clearTimeout')
    setString.mockReset().mockResolvedValue(undefined)
  })
  afterEach(() => {
    setSpy.mockRestore()
    clearSpy.mockRestore()
    jest.useRealTimers()
  })

  it('writes the value, flips copied, and reverts after the given duration', async () => {
    const { result } = await renderHook(() => useCopyToClipboard(2000))
    await act(async () => {
      expect(await result.current.copy('abc')).toBe(true)
    })
    expect(setString).toHaveBeenCalledWith('abc')
    expect(result.current.copied).toBe(true)

    await act(async () => {
      jest.advanceTimersByTime(1999)
    })
    expect(result.current.copied).toBe(true)
    await act(async () => {
      jest.advanceTimersByTime(1)
    })
    expect(result.current.copied).toBe(false)
  })

  it('restarts the timer when copied again', async () => {
    const { result } = await renderHook(() => useCopyToClipboard(1500))
    await act(async () => {
      await result.current.copy('a')
    })
    await act(async () => {
      jest.advanceTimersByTime(1000)
    })
    await act(async () => {
      await result.current.copy('b')
    })
    await act(async () => {
      jest.advanceTimersByTime(1000)
    })
    expect(result.current.copied).toBe(true)
    await act(async () => {
      jest.advanceTimersByTime(500)
    })
    expect(result.current.copied).toBe(false)
  })

  it('stays copied until reset when the duration is null', async () => {
    const { result } = await renderHook(() => useCopyToClipboard(null))
    await act(async () => {
      await result.current.copy('abc')
    })
    await act(async () => {
      jest.advanceTimersByTime(60_000)
    })
    expect(result.current.copied).toBe(true)
    await act(async () => {
      result.current.reset()
    })
    expect(result.current.copied).toBe(false)
  })

  it('resolves false and stays not-copied when the clipboard write fails', async () => {
    setString.mockRejectedValue(new Error('denied'))
    const { result } = await renderHook(() => useCopyToClipboard(MS))
    await act(async () => {
      expect(await result.current.copy('abc')).toBe(false)
    })
    expect(result.current.copied).toBe(false)
    expect(hookTimers()).toHaveLength(0)
  })

  it('clears the pending timer on unmount', async () => {
    const { result, unmount } = await renderHook(() => useCopyToClipboard(MS))
    await act(async () => {
      await result.current.copy('abc')
    })
    const [handle] = hookTimers()
    expect(hookTimers()).toHaveLength(1)
    await unmount()
    expect(clearSpy).toHaveBeenCalledWith(handle)
  })

  it('does not arm a timer when the write resolves after unmount', async () => {
    let release: () => void = () => {}
    setString.mockReturnValue(new Promise<void>((resolve) => { release = resolve }))
    const { result, unmount } = await renderHook(() => useCopyToClipboard(MS))
    let pending: Promise<boolean> = Promise.resolve(false)
    await act(async () => {
      pending = result.current.copy('abc')
    })
    await unmount()
    await act(async () => {
      release()
      await pending
    })
    expect(hookTimers()).toHaveLength(0)
  })
})
