import React from 'react'
import { View, StyleSheet } from 'react-native'
import { KnightRiderScanner } from '@/components/sessions/KnightRiderScanner'

interface Props {
  visible: boolean
  // banner: centered above the list (single-server Hub/Tree).
  // caption: top-right, under the header fallback spinner (single-server Classic).
  variant: 'banner' | 'caption'
}

export function SyncCachedNotice({ visible, variant }: Props) {
  if (!visible) return null

  return (
    <View
      style={[styles.base, variant === 'banner' ? styles.banner : styles.caption]}
      pointerEvents="none"
      testID={`sync-cached-notice-${variant}`}
    >
      <KnightRiderScanner size={variant === 'banner' ? 'banner' : 'compact'} />
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    position: 'absolute',
    top: 8,
    zIndex: 5,
  },
  banner: {
    alignSelf: 'center',
  },
  caption: {
    top: 4,
    end: 14,
  },
})
