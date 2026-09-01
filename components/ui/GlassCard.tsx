import React from 'react'
import { StyleSheet } from 'react-native'
import type { ViewStyle } from 'react-native'
import { radius, spacing } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { GlassView } from './GlassView'

interface GlassCardProps {
  children: React.ReactNode
  style?: ViewStyle
  variant?: 'default' | 'warning' | 'danger'
  testID?: string
}

/**
 * Card-level frosted-glass wrapper. Mirrors the visual tokens of `Card`
 * (radius.md, padding, border, translucent card fill) but renders its
 * background through a `GlassView` blur. Used as the root of `Card` when the
 * active theme is glass — `BlurView` does not honor NativeWind classes, so the
 * card styling lives here as plain RN styles.
 */
export function GlassCard({ children, style, variant = 'default', testID }: GlassCardProps) {
  const theme = useTheme()
  const s = makeStyles()
  const borderColor =
    variant === 'warning'
      ? theme.status.waiting
      : variant === 'danger'
        ? theme.status.failed
        : theme.border

  return (
    <GlassView testID={testID} style={[s.card, { borderColor }, style]}>
      {children}
    </GlassView>
  )
}

function makeStyles() {
  return StyleSheet.create({
    card: {
      borderRadius: radius.md,
      padding: spacing.md,
      borderWidth: 1,
      marginBottom: spacing.sm,
      gap: spacing.xs,
      overflow: 'hidden',
    },
  })
}
