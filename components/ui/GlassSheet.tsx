import React from 'react'
import { StyleSheet, View } from 'react-native'
import type { BottomSheetBackgroundProps } from '@gorhom/bottom-sheet'
import { radius, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { GlassView } from './GlassView'

/**
 * Frosted-glass background for `@gorhom/bottom-sheet`. Pass as the
 * `backgroundComponent` prop when the active theme is glass. Uses a lower blur
 * intensity than cards since sheets already partially obscure the background.
 * The incoming `style` carries the sheet's rounded top corners.
 */
export function GlassSheet({ style, pointerEvents }: BottomSheetBackgroundProps) {
  const theme = useTheme()
  const s = makeStyles(theme)

  return (
    <GlassView intensity={60} pointerEvents={pointerEvents} style={[s.background, style]}>
      <View style={s.fill} pointerEvents="none" />
    </GlassView>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    background: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      overflow: 'hidden',
    },
    fill: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.bg.secondary,
    },
  })
}
