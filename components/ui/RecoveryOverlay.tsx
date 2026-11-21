import React, { useEffect, useMemo, useState } from 'react'
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { X } from 'phosphor-react-native'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { useReduceMotion } from '@/hooks/useAccessibilitySettings'

interface Props {
  visible: boolean
  /** What is retrying, e.g. `Win · GET /sessions`. */
  detail?: string
  /** Shows a close button in the expanded card that calls this. */
  onDismiss?: () => void
}

const LINE_HEIGHT = 3
const HANDLE_OFFSET = 45
const HANDLE_HIT = 44
const CARD_HEIGHT = 80
const DRAG_THRESHOLD = 16
const SWEEP_WIDTH = 96

/**
 * A 3pt scanner along the top of the screen while a query retries or the
 * socket reconnects. A grabber a little below it opens a card with the server,
 * the route and a close button; drag it down to open and up to close. Only the
 * grabber and the card take touches.
 */
export function RecoveryOverlay({ visible, detail, onDismiss }: Props) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const insets = useSafeAreaInsets()
  const { t } = useTranslation('common')
  const [expanded, setExpanded] = useState(false)

  if (!visible && expanded) setExpanded(false)

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_e, g) => Math.abs(g.dy) > 6,
        onPanResponderRelease: (_e, g) => {
          if (g.dy > DRAG_THRESHOLD) setExpanded(true)
          else if (g.dy < -DRAG_THRESHOLD) setExpanded(false)
        },
      }),
    [],
  )

  if (!visible) return null

  return (
    <View pointerEvents="box-none" style={[styles.lane, { top: insets.top }]} testID="recovery-overlay">
      <EdgeScanner color={theme.text.accent} trackColor={theme.border} label={t('recovery.title')} />
      {expanded ? (
        <View style={styles.card} testID="recovery-card">
          <View style={styles.cardRow}>
            <View style={styles.cardText}>
              <Text style={styles.title} numberOfLines={1}>
                {t('recovery.title')}
              </Text>
              {detail ? (
                <Text style={styles.detail} numberOfLines={1} testID="recovery-detail">
                  {detail}
                </Text>
              ) : null}
            </View>
            {onDismiss ? (
              <Pressable
                onPress={onDismiss}
                hitSlop={4}
                style={styles.close}
                accessibilityRole="button"
                accessibilityLabel={t('recovery.dismiss')}
                testID="recovery-dismiss"
              >
                <X size={16} color={theme.text.secondary} />
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
      <View
        style={[styles.handleHit, { top: (expanded ? CARD_HEIGHT - 12 : HANDLE_OFFSET) - HANDLE_HIT / 2 }]}
        {...pan.panHandlers}
      >
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={t('recovery.details')}
          accessibilityState={{ expanded }}
          style={styles.handleTap}
          testID="recovery-handle"
        >
          <View style={styles.grabber} />
        </Pressable>
      </View>
    </View>
  )
}

function EdgeScanner({ color, trackColor, label }: { color: string; trackColor: string; label: string }) {
  const { width } = useWindowDimensions()
  const reduceMotion = useReduceMotion()
  const [progress] = useState(() => new Animated.Value(0))

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(0.5)
      return
    }
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1400,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
        isInteraction: false,
      }),
    )
    loop.start()
    return () => loop.stop()
  }, [progress, reduceMotion])

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-SWEEP_WIDTH, width] })

  return (
    <View
      pointerEvents="none"
      style={{ height: LINE_HEIGHT, overflow: 'hidden', backgroundColor: trackColor }}
      testID="recovery-scanner"
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
    >
      <Animated.View
        style={{ width: SWEEP_WIDTH, height: LINE_HEIGHT, backgroundColor: color, transform: [{ translateX }] }}
      />
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    lane: {
      position: 'absolute',
      left: 0,
      right: 0,
      zIndex: 50,
    },
    card: {
      position: 'absolute',
      top: 0,
      left: spacing.md,
      right: spacing.md,
      paddingTop: LINE_HEIGHT + spacing.sm,
      height: CARD_HEIGHT,
      paddingStart: spacing.md,
      backgroundColor: theme.bg.card,
      borderBottomStartRadius: radius.lg,
      borderBottomEndRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    cardText: { flex: 1 },
    title: { color: theme.text.primary, fontSize: font.sm, fontWeight: '600' },
    detail: { color: theme.text.secondary, fontSize: font.sm },
    close: {
      width: 44,
      height: 44,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    handleHit: {
      position: 'absolute',
      alignSelf: 'center',
      width: 120,
      height: HANDLE_HIT,
    },
    handleTap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    grabber: {
      width: 36,
      height: 5,
      borderRadius: radius.full,
      backgroundColor: theme.text.secondary,
      opacity: 0.6,
    },
  })
}
