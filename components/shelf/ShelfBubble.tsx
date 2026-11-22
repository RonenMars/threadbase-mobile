import React, { useEffect, useMemo, useState } from 'react'
import {
  Animated as RNAnimated,
  Easing as RNEasing,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type AccessibilityActionEvent,
} from 'react-native'
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  ZoomIn,
  ZoomOut,
} from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { ChatsCircle } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { FAB_CLEARANCE } from '@/components/ui/FAB'
import { GlassView } from '@/components/ui/GlassView'
import { font, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { formatBadgeCount, isWithinRadius, snapSide } from '@/lib/savedShelf'
import type { ShelfPosition } from '@/stores/quickAccess'
import { DISMISS_TARGET_SIZE, ShelfDismissTarget } from './ShelfDismissTarget'

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
// Slightly over-damped and clamped: the glide to the edge carries the finger's
// speed but never overshoots the edge (design system: no bounce).
const SNAP_SPRING = { stiffness: 180, damping: 28, overshootClamping: true }
const PRESSED_SCALE = 0.96
const LIFTED_SCALE = 1.04
const PULSE_HALF_MS = 800
const TARGET_BOTTOM_GAP = 32
// Close enough that the bubble is clearly over the X, far enough that a drop beside it does not count.
const HIT_RADIUS = 72
const MAGNET = { duration: 90, easing: EASE_OUT }
const SHRINK = { duration: 160, easing: EASE_IN }

interface Props {
  position: ShelfPosition | null
  isRTL: boolean
  reduceMotion: boolean
  needsYouCount: number
  onOpen: () => void
  onToggleSave: () => void
  onHide: () => void
  onSnap: (position: ShelfPosition) => void
}

/**
 * Draggable bubble that snaps to the nearest side edge. It stays out of the
 * header and out of the bottom band that holds the Hub's FAB, the composer and
 * the resting question card.
 */
export function ShelfBubble({ position, isRTL, reduceMotion, needsYouCount, onOpen, onToggleSave, onHide, onSnap }: Props) {
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
  // While dragging the bubble may go down to the X's row, which is below the band it rests in.
  const targetCenterX = width / 2
  const targetCenterY = height - insets.bottom - TARGET_BOTTOM_GAP - DISMISS_TARGET_SIZE / 2
  const dragMaxY = Math.max(maxY, targetCenterY - BUBBLE_SIZE / 2)
  const restX = side === 'left' ? minX : maxX
  const restY = Math.min(maxY, Math.max(minY, (position?.y ?? DEFAULT_Y) * height))

  const x = useSharedValue(restX)
  const y = useSharedValue(restY)
  const startX = useSharedValue(restX)
  const startY = useSharedValue(restY)
  const scale = useSharedValue(1)
  const dragging = useSharedValue(0)
  const armed = useSharedValue(0)
  const dismissing = useSharedValue(false)
  const [glow] = useState(() => new RNAnimated.Value(1))

  // React Native's native driver, not Reanimated: a Reanimated animation commits
  // the whole surface's shadow tree on every frame it runs, and this one runs for
  // as long as the badge is on screen. Measured on an iPhone 17 Pro, moving the
  // hub's idle animations off Reanimated took the main thread from 42% of a core
  // to 9%. The native driver writes opacity straight to the view instead.
  const hasBadge = needsYouCount > 0
  useEffect(() => {
    if (!hasBadge || reduceMotion) {
      glow.setValue(1)
      return
    }
    const fade = (toValue: number) =>
      RNAnimated.timing(glow, {
        toValue,
        duration: PULSE_HALF_MS,
        easing: RNEasing.bezier(0.2, 0.7, 0.2, 1),
        useNativeDriver: true,
        isInteraction: false,
      })
    const loop = RNAnimated.loop(RNAnimated.sequence([fade(0.4), fade(1)]))
    loop.start()
    return () => loop.stop()
  }, [glow, hasBadge, reduceMotion])

  // Rotation, a new inset or a language switch moves the resting point. A drag
  // saves its position only after the glide lands, so this never cuts it short.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    x.value = restX
    // eslint-disable-next-line react-hooks/immutability
    y.value = restY
    // x/y are stable Reanimated shared values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restX, restY])

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
        // eslint-disable-next-line react-hooks/immutability
        dragging.value = 1
      })
      .onUpdate((e) => {
        'worklet'
        // eslint-disable-next-line react-hooks/immutability
        const nextX = Math.min(maxX, Math.max(minX, startX.value + e.translationX))
        const nextY = Math.min(dragMaxY, Math.max(minY, startY.value + e.translationY))
        const over = isWithinRadius(nextX + BUBBLE_SIZE / 2, nextY + BUBBLE_SIZE / 2, targetCenterX, targetCenterY, HIT_RADIUS)
        if (over && !armed.value) {
          // eslint-disable-next-line react-hooks/immutability
          armed.value = 1
          runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium)
          // Pulled onto the X once, not re-pulled every frame the finger stays near it.
          // eslint-disable-next-line react-hooks/immutability
          x.value = reduceMotion ? targetCenterX - BUBBLE_SIZE / 2 : withTiming(targetCenterX - BUBBLE_SIZE / 2, MAGNET)
          // eslint-disable-next-line react-hooks/immutability
          y.value = reduceMotion ? targetCenterY - BUBBLE_SIZE / 2 : withTiming(targetCenterY - BUBBLE_SIZE / 2, MAGNET)
          return
        }
        if (over) return
        // eslint-disable-next-line react-hooks/immutability
        armed.value = 0
        // eslint-disable-next-line react-hooks/immutability
        x.value = nextX
        // eslint-disable-next-line react-hooks/immutability
        y.value = nextY
      })
      .onEnd((e) => {
        'worklet'
        if (armed.value) {
          // eslint-disable-next-line react-hooks/immutability
          dismissing.value = true
          if (reduceMotion) {
            runOnJS(onHide)()
            return
          }
          // eslint-disable-next-line react-hooks/immutability
          scale.value = withTiming(0, SHRINK, (finished) => {
            if (finished) runOnJS(onHide)()
          })
          return
        }
        const side = snapSide(x.value + BUBBLE_SIZE / 2, e.velocityX, width)
        const targetX = side === 'left' ? minX : maxX
        // A drag may end below the resting band; it settles back inside it.
        const settledY = Math.min(maxY, y.value)
        const settled = { side, y: height > 0 ? settledY / height : DEFAULT_Y }
        // eslint-disable-next-line react-hooks/immutability
        y.value = reduceMotion ? settledY : withTiming(settledY, LIFT)
        // Saving moves the resting point, which re-seats x, so save only once the
        // glide has landed; saving on release would cut the glide short.
        if (reduceMotion) {
          // eslint-disable-next-line react-hooks/immutability
          x.value = targetX
          runOnJS(onSnap)(settled)
          return
        }
        // eslint-disable-next-line react-hooks/immutability
        x.value = withSpring(targetX, { ...SNAP_SPRING, velocity: e.velocityX }, (finished) => {
          if (finished) runOnJS(onSnap)(settled)
        })
      })
      .onFinalize(() => {
        'worklet'
        // eslint-disable-next-line react-hooks/immutability
        dragging.value = 0
        // eslint-disable-next-line react-hooks/immutability
        armed.value = 0
        // A dismissed bubble keeps shrinking; restoring its scale here would bring it back for a frame.
        if (dismissing.value) return
        // eslint-disable-next-line react-hooks/immutability
        scale.value = reduceMotion ? 1 : withTiming(1, PRESS)
      })
    const longPress = Gesture.LongPress().runOnJS(true).onStart(onToggleSave)
    const tap = Gesture.Tap().runOnJS(true).onEnd(onOpen)
    return Gesture.Race(pan, longPress, tap)
    // x/y/startX/startY are stable Reanimated shared values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minX, maxX, minY, maxY, dragMaxY, targetCenterX, targetCenterY, width, height, reduceMotion, onOpen, onToggleSave, onHide, onSnap])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }))

  const badge = formatBadgeCount(needsYouCount)
  const accessibilityLabel = needsYouCount > 0
    ? t('shelf.openWithCount', { n: needsYouCount })
    : t('shelf.open')
  const accessibilityActions = [
    { name: 'activate' as const },
    { name: 'longpress' as const, label: t('shelf.toggleSaveAction') },
    { name: 'hide' as const, label: t('shelf.hideAction') },
  ]

  function handleAccessibilityAction(e: AccessibilityActionEvent) {
    if (e.nativeEvent.actionName === 'activate') onOpen()
    else if (e.nativeEvent.actionName === 'longpress') onToggleSave()
    else if (e.nativeEvent.actionName === 'hide') onHide()
  }

  return (
    <>
    <ShelfDismissTarget dragging={dragging} armed={armed} centerX={targetCenterX} centerY={targetCenterY} reduceMotion={reduceMotion} />
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
            <RNAnimated.View style={[styles.badgeGlow, { opacity: glow }]} pointerEvents="none" />
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </Animated.View>
    </GestureDetector>
    </>
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
