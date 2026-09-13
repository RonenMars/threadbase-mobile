import React, { forwardRef, useEffect, useState } from 'react'
import { TouchableOpacity, Text, StyleSheet, Animated, type View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Plus } from 'phosphor-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/contexts/ThemeContext'
import { font } from '@/constants/theme'

interface Props {
  onPress: () => void
  onLayout?: () => void
}

export const FAB = forwardRef<View, Props>(function FAB({ onPress, onLayout }, ref) {
  const insets = useSafeAreaInsets()
  const theme = useTheme()
  const { t } = useTranslation('sessions')
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
      accessibilityLabel={t('fab.newSession')}
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
      <Plus size={16} color={theme.bg.primary} weight="bold" />
      <Text style={[styles.label, { color: theme.bg.primary }]}>{t('fab.newSession')}</Text>
    </TouchableOpacity>
  )
})

const FAB_HEIGHT = 44
const FAB_BOTTOM = 24
/**
 * Bottom padding a scrolling list needs above the safe-area inset so its last
 * row can scroll clear of the action pill: offset, height, and a gap.
 */
export const FAB_CLEARANCE = FAB_BOTTOM + FAB_HEIGHT + 28

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    // Physical right in both directions — `end` would pin this to the left in RTL.
    right: 20,
    height: FAB_HEIGHT,
    paddingHorizontal: 18,
    borderRadius: FAB_HEIGHT / 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(88,166,255,0.35)',
    // iOS shadow
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    // Android elevation
    elevation: 8,
  },
  label: {
    fontSize: font.sm,
    fontWeight: '600',
  },
  glow: {
    position: 'absolute',
    top: -10,
    bottom: -10,
    left: -10,
    right: -10,
    borderRadius: (FAB_HEIGHT + 20) / 2,
    // no pointer events needed — purely decorative
  },
})
