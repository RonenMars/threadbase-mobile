import React, { forwardRef, useEffect, useRef, useState } from 'react'
import { TouchableOpacity, Text, StyleSheet, Animated, type View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Plus } from 'phosphor-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/contexts/ThemeContext'
import { font } from '@/constants/theme'
import { useReduceMotion } from '@/hooks/useAccessibilitySettings'

interface Props {
  onPress: () => void
  onLayout?: () => void
  /** Scroll-down compact mode: icon only, label hidden. */
  collapsed?: boolean
}

const EXPANDED_PAD = 18
const COLLAPSED_PAD = 14
const LABEL_MAX = 160

export const FAB = forwardRef<View, Props>(function FAB({ onPress, onLayout, collapsed = false }, ref) {
  const insets = useSafeAreaInsets()
  const theme = useTheme()
  const { t } = useTranslation('sessions')
  const [glowAnim] = useState(() => new Animated.Value(0.08))
  const collapseAnim = useRef(new Animated.Value(0)).current
  const reduceMotion = useReduceMotion()

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
    if (!reduceMotion) loop.start()
    return () => loop.stop()
  }, [glowAnim, reduceMotion])

  useEffect(() => {
    Animated.timing(collapseAnim, {
      toValue: collapsed ? 1 : 0,
      duration: reduceMotion ? 0 : 180,
      useNativeDriver: false,
    }).start()
  }, [collapsed, collapseAnim, reduceMotion])

  const label = t('fab.newSession')

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.fab,
        {
          bottom: FAB_BOTTOM + insets.bottom,
          backgroundColor: theme.text.accent,
          shadowColor: theme.text.accent,
        },
      ]}
    >
      <TouchableOpacity
        ref={ref}
        onPress={onPress}
        onLayout={onLayout}
        activeOpacity={0.75}
        accessibilityLabel={label}
        accessibilityRole="button"
        testID="fab-new-session"
        style={styles.hitWrap}
      >
        <Animated.View
          style={[
            styles.hit,
            {
              paddingHorizontal: collapseAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [EXPANDED_PAD, COLLAPSED_PAD],
              }),
            },
          ]}
        >
          {/* glow halo */}
          <Animated.View
            pointerEvents="none"
            style={[styles.glow, { opacity: glowAnim, backgroundColor: theme.text.accent }]}
          />
          <Plus size={16} color={theme.bg.primary} weight="bold" />
          <Animated.View
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            style={{
              opacity: collapseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
              maxWidth: collapseAnim.interpolate({ inputRange: [0, 1], outputRange: [LABEL_MAX, 0] }),
              marginStart: collapseAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }),
              overflow: 'hidden',
            }}
          >
            <Text style={[styles.label, { color: theme.bg.primary }]} numberOfLines={1}>
              {label}
            </Text>
          </Animated.View>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
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
    borderRadius: FAB_HEIGHT / 2,
    borderWidth: 1,
    borderColor: 'rgba(88,166,255,0.35)',
    // iOS shadow
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    // Android elevation
    elevation: 8,
    zIndex: 2,
  },
  hitWrap: {
    height: FAB_HEIGHT,
    borderRadius: FAB_HEIGHT / 2,
  },
  hit: {
    height: FAB_HEIGHT,
    borderRadius: FAB_HEIGHT / 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: font.sm,
    fontWeight: '600',
  },
  glow: {
    position: 'absolute',
    top: -4,
    bottom: -4,
    left: -4,
    right: -4,
    borderRadius: (FAB_HEIGHT + 8) / 2,
  },
})
