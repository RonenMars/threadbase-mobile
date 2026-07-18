import React from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLoadingStateStore } from '@/stores/loading-state'
import { font, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'

// ponytail: standard iOS/Android nav-bar row height; keeps the banner below the topbar back button
const NAV_BAR_HEIGHT = 44

export function SlowQueryBanner() {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const isSlow = useLoadingStateStore((s) => s.slowCounts.sessions > 0 || s.slowCounts.other > 0)
  const insets = useSafeAreaInsets()

  if (!isSlow) return null

  return (
    <View style={[styles.strip, { top: insets.top + NAV_BAR_HEIGHT }]}>
      <ActivityIndicator size="small" color={theme.text.warning} />
      <Text style={styles.text}>
        {'Fetching sessions is taking longer than expected.\nHold still…'}
      </Text>
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    strip: {
      position: 'absolute',
      left: 0,
      right: 0,
      zIndex: 9999,
      backgroundColor: theme.bg.secondary,
      borderBottomWidth: 1,
      borderBottomColor: theme.text.warning,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    text: {
      color: theme.text.warning,
      fontSize: font.sm,
      flex: 1,
    },
  })
}
