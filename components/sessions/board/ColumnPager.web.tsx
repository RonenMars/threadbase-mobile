import React, { useLayoutEffect, useRef, useState } from 'react'
import { ScrollView, type ScrollViewInstance, StyleSheet, View } from 'react-native'
import { useAppDirection } from '@/lib/rtl'

interface Props {
  /** One per page, in order; a page keeps its key while pages appear or vanish around it. */
  keys: readonly string[]
  index: number
  onIndexChange: (index: number) => void
  animate: boolean
  children: React.ReactNode[]
}

/** A snapping horizontal scroller; on RTL web scrollLeft runs negative, hence the signed offset. */
export function ColumnPager({ keys, index, onIndexChange, animate, children }: Props) {
  const scroller = useRef<ScrollViewInstance>(null)
  const shownIndex = useRef(index)
  const shownKey = useRef(keys[index])
  // Set while a chip tap scrolls, so the pages passed on the way do not reselect themselves.
  const settling = useRef<number | null>(null)
  const [width, setWidth] = useState(0)
  const { isRTL } = useAppDirection()
  const sign = isRTL ? -1 : 1

  useLayoutEffect(() => {
    if (width === 0) return
    const scrollTo = (page: number, animated: boolean) => {
      settling.current = page
      scroller.current?.scrollTo({ x: sign * page * width, animated })
    }
    // The scroll offset stays put when a page is inserted or removed before the one on screen.
    const from = keys.indexOf(shownKey.current)
    if (from !== -1 && from !== shownIndex.current) {
      shownIndex.current = from
      scrollTo(from, false)
    }
    const target = keys[index]
    if (target === shownKey.current) return
    shownKey.current = target
    shownIndex.current = index
    scrollTo(index, animate && from !== -1)
  })

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
        if (page === shownIndex.current) return
        shownIndex.current = page
        shownKey.current = keys[page]
        onIndexChange(page)
      }}
    >
      {children.map((child, i) => (
        <View key={keys[i]} style={{ width }}>{child}</View>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({ fill: { flex: 1 } })
