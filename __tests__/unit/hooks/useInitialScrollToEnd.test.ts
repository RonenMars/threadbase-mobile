import { useRef } from 'react'
import { renderHook, act } from '@testing-library/react-native'
import { useInitialScrollToEnd } from '@/hooks/useInitialScrollToEnd'

async function setup(enabled = true) {
  const scrollToEnd = jest.fn()
  const hook = await renderHook(
    ({ on }: { on: boolean }) => {
      const listRef = useRef({ scrollToEnd })
      return useInitialScrollToEnd(listRef, on)
    },
    { initialProps: { on: enabled } },
  )
  return { ...hook, scrollToEnd }
}

describe('useInitialScrollToEnd', () => {
  it('scrolls to end while the first-load pin is active', async () => {
    const { result, scrollToEnd } = await setup()
    await act(() => {
      result.current.stickToEnd()
    })
    expect(scrollToEnd).toHaveBeenCalledWith({ animated: false })
  })

  it('keeps pinning across content-size changes until the user drags', async () => {
    const { result, scrollToEnd } = await setup()
    await act(() => {
      result.current.stickToEnd()
      result.current.stickToEnd()
    })
    expect(scrollToEnd).toHaveBeenCalledTimes(2)
    await act(() => {
      result.current.releasePin()
      result.current.stickToEnd()
    })
    expect(scrollToEnd).toHaveBeenCalledTimes(2)
  })

  it('does not scroll when disabled (anchored search)', async () => {
    const { result, scrollToEnd } = await setup(false)
    await act(() => {
      result.current.stickToEnd()
    })
    expect(scrollToEnd).not.toHaveBeenCalled()
  })

  it('stops pinning if enabled flips off after mount', async () => {
    const { result, rerender, scrollToEnd } = await setup(true)
    await rerender({ on: false })
    await act(() => {
      result.current.stickToEnd()
    })
    expect(scrollToEnd).not.toHaveBeenCalled()
  })
})
