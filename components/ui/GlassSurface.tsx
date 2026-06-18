import React from 'react'
import { StyleSheet, View } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import { useIsGlass } from '@/contexts/ThemeContext'
import { GlassView } from './GlassView'

interface GlassSurfaceProps {
  /** The surface's opaque base style (e.g. `styles.sheet`). */
  baseStyle: StyleProp<ViewStyle>
  /**
   * Component to render as the wrapper. Defaults to `View`; pass `Pressable`
   * (with its own props, e.g. `onPress`) when the surface needs to swallow
   * backdrop taps.
   */
  as?: React.ComponentType<any>
  style?: StyleProp<ViewStyle>
  children?: React.ReactNode
  /** Forwarded to the wrapper (e.g. `pointerEvents`, `onPress`, `testID`). */
  [key: string]: unknown
}

/**
 * Opaque container that turns frosted under the Apple Glass theme. Replaces the
 * repeated `<View style={[styles.sheet, isGlass && styles.sheetGlass]}>` +
 * `{isGlass ? <GlassView .../> : null}` trio (and its per-file `sheetGlass` /
 * `glassFill` StyleSheet entries) found in the plain-`Modal` sheets.
 *
 * Under glass: drops the base `backgroundColor`, clips to bounds, and fills with
 * a blurred `GlassView`. Otherwise renders the base style unchanged.
 */
export function GlassSurface({ baseStyle, as: Wrapper = View, children, style, ...rest }: GlassSurfaceProps) {
  const isGlass = useIsGlass()

  return (
    <Wrapper style={[baseStyle, isGlass && styles.glass, style]} {...rest}>
      {isGlass ? <GlassView style={StyleSheet.absoluteFill} pointerEvents="none" /> : null}
      {children}
    </Wrapper>
  )
}

const styles = StyleSheet.create({
  glass: {
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
})
