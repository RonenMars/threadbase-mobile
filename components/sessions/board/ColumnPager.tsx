import React, { useLayoutEffect, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import PagerView from 'react-native-pager-view'
import { useAppDirection } from '@/lib/rtl'

interface Props {
  /** One per page, in order; a page keeps its key while pages appear or vanish around it. */
  keys: readonly string[]
  index: number
  onIndexChange: (index: number) => void
  animate: boolean
  children: React.ReactNode[]
}

/** Native paging. The web build has no pager-view, so `ColumnPager.web.tsx` takes this path there. */
export function ColumnPager({ keys, index, onIndexChange, animate, children }: Props) {
  const pager = useRef<PagerView>(null)
  const shownIndex = useRef(index)
  const shownKey = useRef(keys[index])
  const { direction } = useAppDirection()

  // A layout effect, so a page inserted or removed before the one on screen is corrected before it paints.
  useLayoutEffect(() => {
    // iOS keeps the selected index, not the page, when the page count changes; snap back to the page.
    const from = keys.indexOf(shownKey.current)
    const moved = from !== -1 && from !== shownIndex.current
    if (moved) {
      shownIndex.current = from
      pager.current?.setPageWithoutAnimation(from)
    }
    const target = keys[index]
    if (target === shownKey.current) return
    shownKey.current = target
    shownIndex.current = index
    if (!animate || from === -1) pager.current?.setPageWithoutAnimation(index)
    // The snap has to land first, or the slide starts from the wrong page.
    else if (moved) requestAnimationFrame(() => pager.current?.setPage(index))
    else pager.current?.setPage(index)
  })

  return (
    <PagerView
      ref={pager}
      style={styles.fill}
      testID="board-pager"
      initialPage={index}
      // The app mirrors through Yoga, not I18nManager, so the pager's own 'locale' default would read LTR.
      layoutDirection={direction}
      onPageSelected={(e) => {
        const position = e.nativeEvent.position
        shownIndex.current = position
        if (keys[position] === shownKey.current) return
        shownKey.current = keys[position]
        onIndexChange(position)
      }}
    >
      {children.map((child, i) => (
        <View key={keys[i]} style={styles.fill} collapsable={false}>{child}</View>
      ))}
    </PagerView>
  )
}

const styles = StyleSheet.create({ fill: { flex: 1 } })
