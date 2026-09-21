import React, { useEffect, useMemo } from 'react'
import { StyleSheet, Text, View, useWindowDimensions, type AccessibilityActionEvent } from 'react-native'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChatsCircle } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { FAB_CLEARANCE } from '@/components/ui/FAB'
import { font, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { formatBadgeCount } from '@/lib/savedShelf'
import type { ShelfPosition } from '@/stores/quickAccess'

export const BUBBLE_SIZE = 52
const EDGE_GAP = 12
const HEADER_HEIGHT = 56
const COMPOSER_HEIGHT = 64
const DEFAULT_Y = 0.35
const SPRING = { damping: 18, stiffness: 180 }

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

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .minDistance(6)
      .onBegin(() => {
        'worklet'
        // eslint-disable-next-line react-hooks/immutability
        startX.value = x.value
        // eslint-disable-next-line react-hooks/immutability
        startY.value = y.value
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
          x.value = withSpring(targetX, SPRING)
        }
        runOnJS(onSnap)({ side: snapLeft ? 'left' : 'right', y: height > 0 ? targetY / height : DEFAULT_Y })
      })
    const longPress = Gesture.LongPress().runOnJS(true).onStart(onToggleSave)
    const tap = Gesture.Tap().runOnJS(true).onEnd(onOpen)
    return Gesture.Race(pan, longPress, tap)
    // x/y/startX/startY are stable Reanimated shared values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minX, maxX, minY, maxY, width, height, reduceMotion, onOpen, onToggleSave, onSnap])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }))

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
        style={[styles.bubble, animatedStyle]}
        accessible
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={t('shelf.hint')}
        accessibilityActions={accessibilityActions}
        onAccessibilityAction={handleAccessibilityAction}
      >
        <ChatsCircle size={28} color={theme.text.onAccent} weight="fill" />
        {badge ? (
          <View style={styles.badge} testID="chat-shelf-badge">
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
      backgroundColor: theme.text.accent,
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 6,
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
    badgeText: {
      color: theme.bg.primary,
      fontSize: font.xs,
      fontWeight: '700',
    },
  })
