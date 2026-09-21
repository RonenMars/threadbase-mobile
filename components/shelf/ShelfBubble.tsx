import React, { useEffect, useMemo } from 'react'
import { Platform, StyleSheet, Text, View, useWindowDimensions, type AccessibilityActionEvent } from 'react-native'
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  ZoomIn,
  ZoomOut,
} from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChatsCircle } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { FAB_CLEARANCE } from '@/components/ui/FAB'
import { GlassView } from '@/components/ui/GlassView'
import { font, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { formatBadgeCount } from '@/lib/savedShelf'
import type { ShelfPosition } from '@/stores/quickAccess'

export const BUBBLE_SIZE = 52
const EDGE_GAP = 12
const HEADER_HEIGHT = 56
const COMPOSER_HEIGHT = 64
const DEFAULT_Y = 0.35
// Design system motion: eased, never overshooting (no springs that bounce).
const EASE_STANDARD = Easing.bezier(0.2, 0.7, 0.2, 1)
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1)
const EASE_IN = Easing.bezier(0.4, 0, 1, 1)
const PRESS = { duration: 120, easing: EASE_STANDARD }
const LIFT = { duration: 180, easing: EASE_STANDARD }
const SNAP = { duration: 280, easing: EASE_OUT }
const PRESSED_SCALE = 0.96
const LIFTED_SCALE = 1.04
const PULSE_HALF_MS = 800

interface Props {
  position: ShelfPosition | null
  isRTL: boolean
  reduceMotion: boolean
  needsYouCount: number
  onOpen: () => void
  onToggleSave: () => void
  onSnap: (position: ShelfPosition) => void
}

/**
 * Draggable bubble that snaps to the nearest side edge. It stays out of the
 * header and out of the bottom band that holds the Hub's FAB, the composer and
 * the resting question card.
 */
export function ShelfBubble({ position, isRTL, reduceMotion, needsYouCount, onOpen, onToggleSave, onSnap }: Props) {
  const { t } = useTranslation('shared')
  const theme = useTheme()
  const styles = useMemo(() => makeStyles(theme), [theme])
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()

  const minX = EDGE_GAP + insets.left
  const maxX = width - BUBBLE_SIZE - EDGE_GAP - insets.right
  const minY = insets.top + HEADER_HEIGHT
  const maxY = Math.max(minY, height - insets.bottom - FAB_CLEARANCE - COMPOSER_HEIGHT - BUBBLE_SIZE)
  // Trailing edge by default: right in LTR, left in RTL.
  const side = position?.side ?? (isRTL ? 'left' : 'right')
  const restX = side === 'left' ? minX : maxX
  const restY = Math.min(maxY, Math.max(minY, (position?.y ?? DEFAULT_Y) * height))

  const x = useSharedValue(restX)
  const y = useSharedValue(restY)
  const startX = useSharedValue(restX)
  const startY = useSharedValue(restY)
  const scale = useSharedValue(1)
  const pulse = useSharedValue(1)

  // Rotation, a new inset or a language switch moves the resting point. After
  // a drag the stored position resolves to exactly where the bubble landed, so
  // this does not cut the snap spring short.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    x.value = restX
    // eslint-disable-next-line react-hooks/immutability
    y.value = restY
    // x/y are stable Reanimated shared values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restX, restY])

  const hasBadge = needsYouCount > 0
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    pulse.value = hasBadge && !reduceMotion
      ? withRepeat(withTiming(0.4, { duration: PULSE_HALF_MS, easing: EASE_STANDARD }), -1, true)
      : 1
    // pulse is a stable Reanimated shared value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasBadge, reduceMotion])

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .minDistance(6)
      .onBegin(() => {
        'worklet'
        // Pan sees every touch first, so it drives the press feedback for tap and long-press too.
        // eslint-disable-next-line react-hooks/immutability
        if (!reduceMotion) scale.value = withTiming(PRESSED_SCALE, PRESS)
        // eslint-disable-next-line react-hooks/immutability
        startX.value = x.value
        // eslint-disable-next-line react-hooks/immutability
        startY.value = y.value
      })
      .onStart(() => {
        'worklet'
        // eslint-disable-next-line react-hooks/immutability
        if (!reduceMotion) scale.value = withTiming(LIFTED_SCALE, LIFT)
      })
      .onUpdate((e) => {
        'worklet'
        // eslint-disable-next-line react-hooks/immutability
        x.value = Math.min(maxX, Math.max(minX, startX.value + e.translationX))
        // eslint-disable-next-line react-hooks/immutability
        y.value = Math.min(maxY, Math.max(minY, startY.value + e.translationY))
      })
      .onEnd(() => {
        'worklet'
        const snapLeft = x.value + BUBBLE_SIZE / 2 < width / 2
        const targetX = snapLeft ? minX : maxX
        const targetY = y.value
        if (reduceMotion) {
          // eslint-disable-next-line react-hooks/immutability
          x.value = targetX
        } else {
          // eslint-disable-next-line react-hooks/immutability
          x.value = withTiming(targetX, SNAP)
        }
        runOnJS(onSnap)({ side: snapLeft ? 'left' : 'right', y: height > 0 ? targetY / height : DEFAULT_Y })
      })
      .onFinalize(() => {
        'worklet'
        // eslint-disable-next-line react-hooks/immutability
        scale.value = reduceMotion ? 1 : withTiming(1, PRESS)
      })
    const longPress = Gesture.LongPress().runOnJS(true).onStart(onToggleSave)
    const tap = Gesture.Tap().runOnJS(true).onEnd(onOpen)
    return Gesture.Race(pan, longPress, tap)
    // x/y/startX/startY are stable Reanimated shared values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minX, maxX, minY, maxY, width, height, reduceMotion, onOpen, onToggleSave, onSnap])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }))
  const glowStyle = useAnimatedStyle(() => ({ opacity: pulse.value }))

  const badge = formatBadgeCount(needsYouCount)
  const accessibilityLabel = needsYouCount > 0
    ? t('shelf.openWithCount', { n: needsYouCount })
    : t('shelf.open')
  const accessibilityActions = [
    { name: 'activate' as const },
    { name: 'longpress' as const, label: t('shelf.toggleSaveAction') },
  ]

  function handleAccessibilityAction(e: AccessibilityActionEvent) {
    if (e.nativeEvent.actionName === 'activate') onOpen()
    else if (e.nativeEvent.actionName === 'longpress') onToggleSave()
  }

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        testID="chat-shelf-bubble"
        entering={reduceMotion ? undefined : ZoomIn.duration(280).easing(EASE_OUT)}
        exiting={reduceMotion ? undefined : ZoomOut.duration(180).easing(EASE_IN)}
        style={[styles.bubble, animatedStyle]}
        accessible
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={t('shelf.hint')}
        accessibilityActions={accessibilityActions}
        onAccessibilityAction={handleAccessibilityAction}
      >
        <View style={styles.glassClip}>
          <GlassView style={StyleSheet.absoluteFill} />
        </View>
        <ChatsCircle size={28} color={theme.text.accent} weight="fill" />
        {badge ? (
          <View style={styles.badge} testID="chat-shelf-badge">
            <Animated.View style={[styles.badgeGlow, glowStyle]} pointerEvents="none" />
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </Animated.View>
    </GestureDetector>
  )
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    bubble: {
      position: 'absolute',
      left: 0,
      top: 0,
      width: BUBBLE_SIZE,
      height: BUBBLE_SIZE,
      borderRadius: BUBBLE_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      // Android elevation needs a background to cast from, and its blur fallback is only a tint,
      // so it gets a near-solid frosted base and a blue edge instead of the glass highlight.
      borderColor: Platform.OS === 'android' ? `${theme.text.accent}38` : 'rgba(255,255,255,0.14)',
      backgroundColor: Platform.OS === 'android' ? `${theme.bg.secondary}eb` : undefined,
      shadowColor: '#000',
      shadowOpacity: 0.22,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    // The shadow lives on the bubble, so the clip that rounds the glass has to be a child.
    glassClip: {
      ...StyleSheet.absoluteFill,
      borderRadius: BUBBLE_SIZE / 2,
      overflow: 'hidden',
    },
    badge: {
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: 20,
      height: 20,
      paddingHorizontal: 5,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.status.waiting,
      borderWidth: 2,
      borderColor: theme.bg.primary,
    },
    badgeGlow: {
      position: 'absolute',
      top: -5,
      left: -5,
      right: -5,
      bottom: -5,
      borderRadius: 15,
      backgroundColor: `${theme.status.waiting}40`,
    },
    badgeText: {
      color: theme.bg.primary,
      fontSize: font.xs,
      fontWeight: '700',
    },
  })
