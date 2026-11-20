import React, { useEffect, useRef, useState } from 'react'
import { ScrollView, type ScrollViewInstance, StyleSheet, View } from 'react-native'
import { useReduceMotion } from '@/hooks/useAccessibilitySettings'
import { swipeLanding } from '@/lib/boardColumns'
import { useAppDirection } from '@/lib/rtl'

interface Props {
  index: number
  onIndexChange: (index: number) => void
  children: React.ReactNode[]
  /** Pages a swipe may settle on; a disabled one stays reachable by `index` only. Every page when omitted. */
  enabled?: readonly boolean[]
}

/** A snapping horizontal scroller; on RTL web scrollLeft runs negative, hence the signed offset. */
export function ColumnPager({ index, onIndexChange, children, enabled }: Props) {
  const scroller = useRef<ScrollViewInstance>(null)
  const shown = useRef(index)
  // Set while a chip tap scrolls, so the pages passed on the way do not reselect themselves.
  const settling = useRef<number | null>(null)
  const [width, setWidth] = useState(0)
  const reduceMotion = useReduceMotion()
  const { isRTL } = useAppDirection()
  const sign = isRTL ? -1 : 1
  const swipeable = enabled ?? children.map(() => true)
  const canSwipe = swipeable.some((on, i) => on && i !== index)

  useEffect(() => {
    if (width === 0 || shown.current === index) return
    shown.current = index
    settling.current = index
    scroller.current?.scrollTo({ x: sign * index * width, animated: !reduceMotion })
  }, [index, width, sign, reduceMotion])

  return (
    <ScrollView
      ref={scroller}
      testID="board-pager"
      horizontal
      pagingEnabled
      scrollEnabled={canSwipe}
      showsHorizontalScrollIndicator={false}
      scrollEventThrottle={32}
      style={styles.fill}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onScroll={(e) => {
        if (width === 0) return
        const page = Math.round(Math.abs(e.nativeEvent.contentOffset.x) / width)
        if (settling.current !== null) {
          if (page === settling.current) settling.current = null
          return
        }
        if (page === shown.current) return
        const landed = swipeLanding(shown.current, page, swipeable)
        shown.current = landed
        if (landed !== page) {
          settling.current = landed
          scroller.current?.scrollTo({ x: sign * landed * width, animated: !reduceMotion })
        }
        onIndexChange(landed)
      }}
    >
      {children.map((child, i) => (
        <View key={i} style={{ width }}>{child}</View>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({ fill: { flex: 1 } })
