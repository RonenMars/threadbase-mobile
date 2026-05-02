import React from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLoadingStateStore } from '@/stores/loading-state'
import { dark, font, spacing } from '@/constants/theme'

export function SlowQueryBanner() {
  const isSlow = useLoadingStateStore((s) => s.slowCounts.sessions > 0 || s.slowCounts.other > 0)
  const insets = useSafeAreaInsets()

  if (!isSlow) return null

  return (
    <View style={[styles.strip, { top: insets.top }]}>
      <ActivityIndicator size="small" color={dark.text.warning} />
      <Text style={styles.text}>
        {'Fetching sessions is taking longer than expected.\nHold still…'}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  strip: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: dark.bg.secondary,
    borderBottomWidth: 1,
    borderBottomColor: dark.text.warning,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  text: {
    color: dark.text.warning,
    fontSize: font.sm,
    flex: 1,
  },
})
