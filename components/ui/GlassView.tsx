import React, { useEffect, useState } from 'react'
import { AccessibilityInfo, Platform, View } from 'react-native'
import type { StyleProp, ViewProps, ViewStyle } from 'react-native'
import { BlurView } from 'expo-blur'
import type { BlurTint } from 'expo-blur'
import {
  GlassView as NativeGlassView,
  isGlassEffectAPIAvailable,
} from 'expo-glass-effect'
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
 * Shared glass surface. On iOS 26+, it renders Expo's bridge to Apple's native
 * Liquid Glass material. Other platforms retain the existing blur treatment.
 */
export function GlassView({ children, style, intensity, tint, ...rest }: GlassViewProps) {
  const theme = useTheme()
  const [reduceTransparency, setReduceTransparency] = useState(false)

  useEffect(() => {
    if (Platform.OS !== 'ios') return

    let mounted = true
    void AccessibilityInfo.isReduceTransparencyEnabled().then((value) => {
      if (mounted) setReduceTransparency(value)
    })
    const subscription = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      setReduceTransparency,
    )
    return () => {
      mounted = false
      subscription.remove()
    }
  }, [])

  if (Platform.OS === 'ios' && isGlassEffectAPIAvailable() && !reduceTransparency) {
    return (
      <NativeGlassView
        glassEffectStyle="regular"
        colorScheme={theme.colorMode}
        style={style}
        {...rest}
      >
        {children}
      </NativeGlassView>
    )
  }

  if (reduceTransparency) {
    return <View style={[style, { backgroundColor: theme.bg.secondary }]} {...rest}>{children}</View>
  }

  return (
    <BlurView intensity={intensity ?? 40} tint={tint ?? (theme.colorMode === 'light' ? 'light' : 'dark')} style={style} {...rest}>
      {children}
    </BlurView>
  )
}
