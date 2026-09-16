import React, { useCallback, useEffect, useMemo } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { X } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { useReduceMotion } from '@/hooks/useAccessibilitySettings'
import { alertAppearance } from '@/lib/alertAppearance'
import { getAlertLevelLabel } from '@/lib/alertLabels'
import { useAlertStore } from '@/stores/alerts'
import type { AlertEntry } from '@/types/alerts'
import { alertFingerprint } from '@/types/alerts'

const DISMISS_DURATION = 220
const DOWN_MAX = 40
const DOWN_THRESHOLD = 20
const TARGET = 44

type Props = {
  toast: AlertEntry
}

export function Toast({ toast }: Props) {
  const { t } = useTranslation('common')
  const stickyDismiss = useAlertStore((s) => s.stickyDismiss)
  const theme = useTheme()
  const reduceMotion = useReduceMotion()
  const styles = useMemo(() => makeStyles(theme), [theme])
  const appearance = alertAppearance(toast.level, theme)
  const Icon = appearance.Icon
  const closeLabel = t('button.close')
  const showClose = toast.hideCloseButton !== true
  const levelLabel = getAlertLevelLabel(toast.level, t)
  const accessibilityLabel = `${levelLabel}. ${toast.title}`
  const liveRegion = toast.level === 'critical' || toast.level === 'error'
    ? 'assertive' as const
    : 'polite' as const
  const titleColor = toast.level === 'info'
    ? theme.text.secondary
    : theme.text.primary
  const bodyRole = toast.onPress ? 'button' as const : undefined

  const translateY = useSharedValue(0)
  const opacity = useSharedValue(1)
  const reduceMotionValue = useSharedValue(reduceMotion ? 1 : 0)
  useEffect(() => {
    reduceMotionValue.value = reduceMotion ? 1 : 0
  }, [reduceMotion, reduceMotionValue])

  const resetAnimation = useCallback(() => {
    // eslint-disable-next-line react-hooks/immutability
    translateY.value = 0
    // eslint-disable-next-line react-hooks/immutability
    opacity.value = 1
    // translateY/opacity are stable Reanimated shared values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A swiped-away toast whose copy then changes comes back, so the transform
  // has to be wound back before the new copy is drawn.
  const fingerprint = alertFingerprint(toast)
  useEffect(() => {
    resetAnimation()
  }, [fingerprint, resetAnimation])

  const handleClose = useCallback(() => {
    toast.onClose?.()
    stickyDismiss(toast.id)
    // `toast` is replaced wholesale on every copy change; the store keeps the
    // callbacks fresh in place otherwise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast, stickyDismiss])

  const pan = useMemo(() => Gesture.Pan()
    .activeOffsetY([-8, 8])
    .onUpdate((e) => {
      'worklet'
      if (reduceMotionValue.value) {
        return
      }
      if (e.translationY < 0) {
        // eslint-disable-next-line react-hooks/immutability
        translateY.value = e.translationY
        // eslint-disable-next-line react-hooks/immutability
        opacity.value = 1 + e.translationY / 60
      } else {
        const clamped = Math.min(e.translationY, DOWN_MAX)
        const overflow = Math.max(0, e.translationY - DOWN_MAX)
        // eslint-disable-next-line react-hooks/immutability
        translateY.value = clamped + overflow * 0.15
      }
    })
    .onEnd((e) => {
      'worklet'
      const shouldDismiss = e.translationY < -40 || e.translationY >= DOWN_THRESHOLD
      if (shouldDismiss) {
        if (!reduceMotionValue.value) {
          // eslint-disable-next-line react-hooks/immutability
          translateY.value = withTiming(-80, { duration: DISMISS_DURATION, easing: Easing.out(Easing.quad) })
        }
        // eslint-disable-next-line react-hooks/immutability
        opacity.value = withTiming(0, { duration: DISMISS_DURATION }, (finished) => {
          if (finished) runOnJS(handleClose)()
        })
      } else {
        // eslint-disable-next-line react-hooks/immutability
        translateY.value = withTiming(0, { duration: 150 })
        // eslint-disable-next-line react-hooks/immutability
        opacity.value = withTiming(1, { duration: 150 })
      }
    })
    .runOnJS(false),
  // translateY/opacity are stable Reanimated shared values
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [handleClose])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: reduceMotionValue.value ? 0 : translateY.value }],
    opacity: opacity.value,
  }))

  function handleBodyPress() {
    toast.onPress?.()
  }

  return (
    <View style={styles.clip}>
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[styles.banner, animatedStyle]}
          accessibilityLiveRegion={liveRegion}
        >
          <TouchableOpacity
            style={styles.body}
            onPress={handleBodyPress}
            accessibilityRole={bodyRole}
            accessibilityLabel={accessibilityLabel}
            disabled={!bodyRole}
            activeOpacity={bodyRole ? 0.7 : 1}
            testID={toast.testID ?? `toast-${toast.id}`}
          >
            {toast.icon ?? (
              <Icon size={16} color={appearance.accent} weight={appearance.iconWeight} />
            )}
            <View style={styles.copy}>
              <Text style={[styles.title, { color: titleColor }]}>
                {toast.title}
              </Text>
              {toast.message ? (
                <Text style={styles.message}>{toast.message}</Text>
              ) : null}
              {toast.details ? (
                <Text style={styles.message}>{toast.details}</Text>
              ) : null}
            </View>
          </TouchableOpacity>
          {toast.buttonText ? (
            <TouchableOpacity
              style={[styles.actionBtn, actionBorder(theme, appearance.accent, toast.buttonVariant)]}
              onPress={() => toast.buttonAction?.()}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={toast.buttonText}
              testID={`toast-action-${toast.id}`}
            >
              <Text style={[styles.actionText, actionText(theme, appearance.accent, toast.buttonVariant)]}>
                {toast.buttonText}
              </Text>
            </TouchableOpacity>
          ) : null}
          {showClose ? (
            <TouchableOpacity
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel={closeLabel}
              style={styles.closeBtn}
              testID={`toast-close-${toast.id}`}
            >
              <X size={16} color={theme.text.secondary} />
            </TouchableOpacity>
          ) : null}
        </Animated.View>
      </GestureDetector>
    </View>
  )
}

function actionBorder(theme: Theme, accent: string, variant: AlertEntry['buttonVariant']) {
  if (variant === 'destructive') return { borderColor: theme.text.danger }
  return { borderColor: accent }
}

function actionText(theme: Theme, accent: string, variant: AlertEntry['buttonVariant']) {
  if (variant === 'destructive') return { color: theme.text.danger }
  return { color: accent }
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    clip: {
      overflow: 'visible',
      zIndex: 10,
    },
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      backgroundColor: theme.bg.secondary,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    body: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    copy: {
      flex: 1,
      gap: 2,
    },
    title: {
      fontSize: font.base,
      fontWeight: '500',
      lineHeight: 20,
    },
    message: {
      fontSize: font.sm,
      fontWeight: '400',
      lineHeight: 18,
      color: theme.text.secondary,
    },
    actionBtn: {
      minHeight: TARGET,
      justifyContent: 'center',
      borderWidth: 1,
      borderRadius: radius.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    actionText: {
      fontSize: font.sm,
      fontWeight: '600',
    },
    closeBtn: {
      width: TARGET,
      height: TARGET,
      alignItems: 'center',
      justifyContent: 'center',
    },
  })
}
