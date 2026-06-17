import React from 'react'
import { StyleSheet, View } from 'react-native'
import type { StyleProp, ViewProps, ViewStyle } from 'react-native'
import { BlurView } from 'expo-blur'
import type { BlurTint } from 'expo-blur'
import { useTheme } from '@/contexts/ThemeContext'

interface GlassViewProps extends ViewProps {
  children?: React.ReactNode
  style?: StyleProp<ViewStyle>
  /** Override the active theme's blur intensity (1–100). */
  intensity?: number
  /** Override the active theme's blur tint. */
  tint?: BlurTint
}

/**
 * Primitive frosted-glass container. When the active theme defines a `glass`
 * field (Apple Glass), renders an expo-blur `BlurView` with a translucent
 * overlay; otherwise renders a plain `View`. This is the only file that imports
 * BlurView — all other glass surfaces compose this.
 */
export function GlassView({ children, style, intensity, tint, ...rest }: GlassViewProps) {
  const theme = useTheme()

  if (theme.glass) {
    return (
      <BlurView
        intensity={intensity ?? theme.glass.intensity}
        tint={tint ?? theme.glass.tint}
        style={style}
        {...rest}
      >
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: theme.glass.overlayColor }]}
          pointerEvents="none"
        />
        {children}
      </BlurView>
    )
  }

  return (
    <View style={style} {...rest}>
      {children}
    </View>
  )
}
