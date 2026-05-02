import React from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLoadingStateStore } from '@/stores/loading-state'
import { dark } from '@/constants/theme'

export function SlowQueryBanner() {
  const isSlow = useLoadingStateStore((s) => s.slowCounts.sessions > 0 || s.slowCounts.other > 0)
  const insets = useSafeAreaInsets()

  if (!isSlow) return null

  return (
    <View
      style={{
        position: 'absolute',
        top: insets.top,
        left: 0,
        right: 0,
        zIndex: 9999,
        backgroundColor: '#1c1e26',
        borderBottomWidth: 1,
        borderBottomColor: dark.text.warning,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 10,
      }}
    >
      <ActivityIndicator size="small" color={dark.text.warning} />
      <Text style={{ color: dark.text.warning, fontSize: 13, flex: 1 }}>
        {'Fetching sessions is taking longer than expected.\nHold still…'}
      </Text>
    </View>
  )
}
