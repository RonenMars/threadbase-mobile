import React, { useEffect, useRef, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useReduceMotion } from '@/hooks/useAccessibilitySettings'
import { useAppDirection } from '@/lib/rtl'

interface Props {
  index: number
  onIndexChange: (index: number) => void
  children: React.ReactNode[]
}

/** A snapping horizontal scroller; on RTL web scrollLeft runs negative, hence the signed offset. */
export function ColumnPager({ index, onIndexChange, children }: Props) {
  const scroller = useRef<ScrollView>(null)
  const shown = useRef(index)
  // Set while a chip tap scrolls, so the pages passed on the way do not reselect themselves.
  const settling = useRef<number | null>(null)
  const [width, setWidth] = useState(0)
  const reduceMotion = useReduceMotion()
  const { isRTL } = useAppDirection()
  const sign = isRTL ? -1 : 1

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
        shown.current = page
        onIndexChange(page)
      }}
    >
      {children.map((child, i) => (
        <View key={i} style={{ width }}>{child}</View>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({ fill: { flex: 1 } })
