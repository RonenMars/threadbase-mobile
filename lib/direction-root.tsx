import React, { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { IconContext } from 'phosphor-react-native'
import { layoutDirectionStyle, useAppDirection } from '@/lib/rtl'

/**
 * Single RTL paint point: Yoga `direction` for layout (web: `writingDirection`
 * → CSS `direction`), Phosphor `IconContext` for directional glyphs. Screens
 * do not pass `mirrored={isRTL}` — icons that already swap Left/Right by
 * locale must set `mirrored={false}` so context does not flip them again.
 */
export function DirectionRoot({ children }: { children: React.ReactNode }) {
  const { direction, isRTL } = useAppDirection()
  const iconDefaults = useMemo(() => ({ mirrored: isRTL }), [isRTL])
  return (
    <IconContext.Provider value={iconDefaults}>
      <View style={[styles.flex, layoutDirectionStyle(direction)]}>{children}</View>
    </IconContext.Provider>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
})
