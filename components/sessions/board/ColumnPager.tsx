import React, { useEffect, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import PagerView from 'react-native-pager-view'
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

/** Native paging. The web build has no pager-view, so `ColumnPager.web.tsx` takes this path there. */
export function ColumnPager({ index, onIndexChange, children, enabled }: Props) {
  const pager = useRef<PagerView>(null)
  const shown = useRef(index)
  const reduceMotion = useReduceMotion()
  const { direction } = useAppDirection()

  useEffect(() => {
    if (shown.current === index) return
    shown.current = index
    if (reduceMotion) pager.current?.setPageWithoutAnimation(index)
    else pager.current?.setPage(index)
  }, [index, reduceMotion])

  const swipeable = enabled ?? children.map(() => true)
  const canSwipe = swipeable.some((on, i) => on && i !== index)

  return (
    <PagerView
      ref={pager}
      style={styles.fill}
      testID="board-pager"
      initialPage={index}
      // The app mirrors through Yoga, not I18nManager, so the pager's own 'locale' default would read LTR.
      layoutDirection={direction}
      scrollEnabled={canSwipe}
      onPageSelected={(e) => {
        const landed = swipeLanding(shown.current, e.nativeEvent.position, swipeable)
        if (landed !== e.nativeEvent.position) pager.current?.setPage(landed)
        shown.current = landed
        onIndexChange(landed)
      }}
    >
      {children.map((child, i) => (
        <View key={i} style={styles.fill} collapsable={false}>{child}</View>
      ))}
    </PagerView>
  )
}

const styles = StyleSheet.create({ fill: { flex: 1 } })
