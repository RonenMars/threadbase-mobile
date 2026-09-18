import { useCallback, useRef, useState } from 'react'
import { Platform, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'

const THRESHOLD = 6
const TOP = 16

/** Hides a floating control while the list is scrolling down; shows it again on up or at the top. */
export function useHideOnScrollDown() {
  const lastY = useRef(0)
  const [hidden, setHidden] = useState(false)

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    // A desktop window has room for the control, and a mouse user has no
    // scroll-up gesture habit to get it back — keep it put on web.
    if (Platform.OS === 'web') return
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
