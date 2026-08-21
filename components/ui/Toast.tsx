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
import { alertAppearance } from '@/lib/alertAppearance'
import { useToastStore, type ToastEntry } from '@/stores/toasts'
import { alertFingerprint } from '@/types/alerts'

const DISMISS_DURATION = 220
const DOWN_MAX = 40
const DOWN_THRESHOLD = 20

type Props = {
  toast: ToastEntry
}

export function Toast({ toast }: Props) {
  const { t } = useTranslation('common')
  const openDetails = useToastStore((s) => s.openDetails)
  const stickyDismiss = useToastStore((s) => s.stickyDismiss)
  const theme = useTheme()
  const styles = useMemo(() => makeStyles(theme), [theme])
  const appearance = alertAppearance(toast.level, theme, toast.accent)
  const Icon = appearance.Icon
  const closeLabel = t('button.close')
  const hasDetails = Boolean(toast.details || toast.message)
  const showClose = toast.hideCloseButton !== true

  const translateY = useSharedValue(0)
  const opacity = useSharedValue(1)

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
      if (e.translationY < -40 || e.translationY >= DOWN_THRESHOLD) {
        // eslint-disable-next-line react-hooks/immutability
        translateY.value = withTiming(-80, { duration: DISMISS_DURATION, easing: Easing.out(Easing.quad) })
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
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }))

  function handleBodyPress() {
    if (toast.onPress) {
      toast.onPress()
      return
    }
    if (hasDetails) openDetails(toast.id)
  }

  const titleColor = toast.level === 'info' || toast.level === 'debug'
    ? theme.text.secondary
    : theme.text.primary
  const bodyRole = toast.onPress || hasDetails ? 'button' as const : undefined

  return (
    <View style={styles.clip}>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.banner, animatedStyle]}>
          <TouchableOpacity
            style={styles.body}
            onPress={handleBodyPress}
            accessibilityRole={bodyRole}
            accessibilityLabel={toast.title}
            disabled={!bodyRole}
            activeOpacity={bodyRole ? 0.7 : 1}
            testID={toast.testID ?? `toast-${toast.id}`}
          >
            {toast.icon ?? (
              <Icon size={16} color={appearance.accent} weight={appearance.iconWeight} />
            )}
            <Text style={[styles.title, { color: titleColor }]} numberOfLines={2}>
              {toast.title}
            </Text>
          </TouchableOpacity>
          {toast.buttonText ? (
            <TouchableOpacity
              style={[styles.actionBtn, actionBorder(theme, appearance.accent, toast.buttonVariant)]}
              onPress={() => toast.buttonAction?.()}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
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
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              testID={`toast-close-${toast.id}`}
            >
              <X size={14} color={theme.text.secondary} />
            </TouchableOpacity>
          ) : null}
        </Animated.View>
      </GestureDetector>
    </View>
  )
}

function actionBorder(theme: Theme, accent: string, variant: ToastEntry['buttonVariant']) {
  if (variant === 'destructive') return { borderColor: theme.text.danger }
  return { borderColor: accent }
}

function actionText(theme: Theme, accent: string, variant: ToastEntry['buttonVariant']) {
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
      paddingHorizontal: spacing.lg,
      backgroundColor: theme.bg.secondary,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    body: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    title: {
      flex: 1,
      fontSize: font.base,
      fontWeight: '500',
      lineHeight: 18,
    },
    actionBtn: {
      borderWidth: 1,
      borderRadius: radius.sm,
      paddingVertical: 3,
      paddingHorizontal: spacing.sm,
    },
    actionText: {
      fontSize: font.xs,
      fontWeight: '600',
    },
  })
}
