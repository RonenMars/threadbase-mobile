import React, { useRef, useEffect } from 'react'
import { TouchableOpacity, StyleSheet, Animated } from 'react-native'
import { Plus } from 'phosphor-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface Props {
  onPress: () => void
}

export function FAB({ onPress }: Props) {
  const insets = useSafeAreaInsets()
  const glowAnim = useRef(new Animated.Value(0.45)).current

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.45,
          duration: 1400,
          useNativeDriver: true,
        }),
      ])
    ).start()
  }, [glowAnim])

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityLabel="New session"
      accessibilityRole="button"
      style={[styles.fab, { bottom: 24 + insets.bottom }]}
    >
      {/* glow halo */}
      <Animated.View style={[styles.glow, { opacity: glowAnim }]} />
      <Plus size={22} color="#e6edf3" weight="bold" />
    </TouchableOpacity>
  )
}

const FAB_SIZE = 56

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: '#1c64f2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(88,166,255,0.35)',
    // iOS shadow
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    // Android elevation
    elevation: 8,
  },
  glow: {
    position: 'absolute',
    width: FAB_SIZE + 20,
    height: FAB_SIZE + 20,
    borderRadius: (FAB_SIZE + 20) / 2,
    backgroundColor: 'rgba(59,130,246,0.18)',
    // no pointer events needed — purely decorative
  },
})
