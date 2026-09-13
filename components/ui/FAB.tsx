import React, { forwardRef, useEffect, useState } from 'react'
import { TouchableOpacity, StyleSheet, Animated, type View } from 'react-native'
import { Plus } from 'phosphor-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/contexts/ThemeContext'

interface Props {
  onPress: () => void
  onLayout?: () => void
}

export const FAB = forwardRef<View, Props>(function FAB({ onPress, onLayout }, ref) {
  const insets = useSafeAreaInsets()
  const theme = useTheme()
  const [glowAnim] = useState(() => new Animated.Value(0.08))

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.18,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.08,
          duration: 1400,
          useNativeDriver: true,
        }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [glowAnim])

  return (
    <TouchableOpacity
      ref={ref}
      onPress={onPress}
      onLayout={onLayout}
      activeOpacity={0.75}
      accessibilityLabel="New session"
      accessibilityRole="button"
      testID="fab-new-session"
      style={[
        styles.fab,
        {
          bottom: FAB_BOTTOM + insets.bottom,
          backgroundColor: theme.text.accent,
          shadowColor: theme.text.accent,
        },
      ]}
    >
      {/* glow halo */}
      <Animated.View
        pointerEvents="none"
        style={[styles.glow, { opacity: glowAnim, backgroundColor: theme.text.accent }]}
      />
      <Plus size={22} color={theme.bg.primary} weight="bold" />
    </TouchableOpacity>
  )
})

const FAB_SIZE = 56
const FAB_BOTTOM = 24
/**
 * Bottom padding a scrolling list needs above the safe-area inset so its last
 * row can scroll clear of the FAB: the button's offset, its height, and a gap.
 */
export const FAB_CLEARANCE = FAB_BOTTOM + FAB_SIZE + 16

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    // Physical right in both directions — `end` would pin this to the left in RTL.
    right: 20,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(88,166,255,0.35)',
    // iOS shadow
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
    // no pointer events needed — purely decorative
  },
})
