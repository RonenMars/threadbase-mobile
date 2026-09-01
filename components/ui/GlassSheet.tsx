import React from 'react'
import { StyleSheet } from 'react-native'
import type { BottomSheetBackgroundProps } from '@gorhom/bottom-sheet'
import { radius } from '@/constants/theme'
import { useIsGlass } from '@/contexts/ThemeContext'
import { GlassView } from './GlassView'

export function useGlassSheetBackground(): typeof GlassSheet | undefined {
  return useIsGlass() ? GlassSheet : undefined
}

export function GlassSheet({ style, pointerEvents }: BottomSheetBackgroundProps) {
  const s = makeStyles()

  return (
    <GlassView intensity={60} pointerEvents={pointerEvents} style={[s.background, style]} />
  )
}

function makeStyles() {
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
  })
}
