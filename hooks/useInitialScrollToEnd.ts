import { useCallback, useEffect, useRef, type RefObject } from 'react'

type ScrollToEndable = {
  scrollToEnd: (params?: { animated?: boolean }) => void
}

/**
 * Keep a newly opened list pinned to the true content bottom.
 *
 * FlashList `startRenderingFromBottom` / a single `onLoad` `scrollToEnd`
 * place the last *row*, using estimated heights. A last message taller than
 * the viewport therefore opens at that row's start. Re-run `scrollToEnd`
 * after each content-size change (markdown / code / images finishing layout)
 * until the user drags — then stop, so older-page prepends cannot yank
 * the reader back to the tail.
 */
export function useInitialScrollToEnd(
  listRef: RefObject<ScrollToEndable | null>,
  enabled: boolean,
) {
  const pinRef = useRef(enabled)

  useEffect(() => {
    if (!enabled) pinRef.current = false
  }, [enabled])

  const stickToEnd = useCallback(() => {
    if (!pinRef.current) return
    listRef.current?.scrollToEnd({ animated: false })
  }, [listRef])

  const releasePin = useCallback(() => {
    pinRef.current = false
  }, [])

  // Re-arm after the caller decides something the reader was waiting at the tail
  // for has arrived. The pin is what makes `stickToEnd` chase a layout that
  // settles over several frames, so re-arming — not a one-off `scrollToEnd` —
  // is what lands on the true bottom of tall new content. The next drag
  // releases it again.
  const repin = useCallback(() => {
    pinRef.current = true
  }, [])

  return { stickToEnd, releasePin, repin }
}
