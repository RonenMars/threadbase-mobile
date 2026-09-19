import { useCallback, useRef, useState } from 'react'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'

const THRESHOLD = 6
const TOP = 16

/** Flags a floating control as compact while scrolling down; clears on up or at the top. */
export function useHideOnScrollDown() {
  const lastY = useRef(0)
  const [hidden, setHidden] = useState(false)

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y
    const dy = y - lastY.current
    lastY.current = y
    if (y < TOP) {
      setHidden(false)
      return
    }
    if (dy > THRESHOLD) setHidden(true)
    else if (dy < -THRESHOLD) setHidden(false)
  }, [])

  const reveal = useCallback(() => {
    lastY.current = 0
    setHidden(false)
  }, [])

  return { hidden, onScroll, reveal }
}
