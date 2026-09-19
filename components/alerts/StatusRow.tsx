import React, { useCallback, useMemo, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { Copy, Check, X } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import * as Clipboard from 'expo-clipboard'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { useReduceMotion } from '@/hooks/useAccessibilitySettings'
import { alertAppearance } from '@/lib/alertAppearance'
import { useAlertStore } from '@/stores/alerts'
import type { AlertEntry } from '@/types/alerts'

const TARGET = 44
const SWIPE_DISMISS_DISTANCE = 80
const SWIPE_DURATION = 180

type Props = {
  entry: AlertEntry
}

export function StatusRow({ entry }: Props) {
  const { t } = useTranslation('common')
  const theme = useTheme()
  const appearance = alertAppearance(entry.level, theme)
  const styles = useMemo(() => makeStyles(theme, appearance.accent), [theme, appearance.accent])
  const Icon = appearance.Icon
  const [detailsOpen, setDetailsOpen] = useState(false)
  const hasTechnical = Boolean(entry.code || entry.rawMessage)
  const showRetry = entry.retryable === true && entry.buttonAction !== undefined
  const retryLabel = entry.retrying ? t('errorBanner.retrying') : (entry.buttonText ?? t('button.retry'))
  const detailsLabel = t('alert.status.technicalDetails')
  const secondaryLabel = entry.buttonText
  const showSecondary = !showRetry && Boolean(entry.buttonText && entry.buttonAction)
  const reduceMotion = useReduceMotion()
  const { width: screenWidth } = useWindowDimensions()
  const translateX = useSharedValue(0)
  const opacity = useSharedValue(1)

  const dismiss = useCallback(() => {
    entry.onClose?.()
    useAlertStore.getState().stickyDismiss(entry.id)
  }, [entry])

  const pan = useMemo(() => Gesture.Pan()
    .withTestId(`status-row-swipe-${entry.id}`)
    .activeOffsetX([-12, 12])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      'worklet'
      // eslint-disable-next-line react-hooks/immutability
      translateX.value = e.translationX
      // eslint-disable-next-line react-hooks/immutability
      opacity.value = 1 - Math.min(1, Math.abs(e.translationX) / screenWidth)
    })
    .onEnd((e) => {
      'worklet'
      if (Math.abs(e.translationX) < SWIPE_DISMISS_DISTANCE) {
        // eslint-disable-next-line react-hooks/immutability
        translateX.value = withTiming(0, { duration: 150 })
        // eslint-disable-next-line react-hooks/immutability
        opacity.value = withTiming(1, { duration: 150 })
        return
      }
      if (reduceMotion) {
        runOnJS(dismiss)()
        return
      }
      // eslint-disable-next-line react-hooks/immutability
      translateX.value = withTiming(Math.sign(e.translationX) * screenWidth, { duration: SWIPE_DURATION })
      // eslint-disable-next-line react-hooks/immutability
      opacity.value = withTiming(0, { duration: SWIPE_DURATION }, (finished) => {
        if (finished) runOnJS(dismiss)()
      })
    })
    .runOnJS(false),
  // translateX/opacity are stable Reanimated shared values
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [dismiss, reduceMotion, screenWidth])

  const swipeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }))

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.row, swipeStyle]} testID={`error-sheet-row-${entry.id}`}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={dismiss}
            hitSlop={8}
            style={styles.dismiss}
            accessibilityRole="button"
            accessibilityLabel={t('alert.status.dismiss')}
            testID={`status-row-dismiss-${entry.id}`}
          >
            <X size={18} color={theme.text.secondary} />
          </TouchableOpacity>
          <Icon size={16} color={appearance.accent} weight={appearance.iconWeight} />
          <Text style={styles.title}>{entry.title}</Text>
        </View>
        <Text style={styles.message}>{entry.message}</Text>
        {entry.details ? <Text style={styles.message}>{entry.details}</Text> : null}
        {showRetry || hasTechnical || showSecondary ? (
          <View style={styles.actions}>
            {showRetry ? (
              <TouchableOpacity
                style={[styles.action, styles.retry]}
                onPress={entry.buttonAction}
                disabled={entry.retrying}
                accessibilityRole="button"
                accessibilityLabel={retryLabel}
                accessibilityState={{ disabled: Boolean(entry.retrying) }}
                testID={`error-sheet-retry-${entry.id}`}
              >
                <Text style={[styles.actionText, styles.retryText]}>{retryLabel}</Text>
              </TouchableOpacity>
            ) : null}
            {hasTechnical ? (
              <TouchableOpacity
                style={styles.action}
                onPress={() => setDetailsOpen((open) => !open)}
                accessibilityRole="button"
                accessibilityLabel={detailsLabel}
                testID={`status-row-details-${entry.id}`}
              >
                <Text style={styles.actionText}>{detailsLabel}</Text>
              </TouchableOpacity>
            ) : null}
            {showSecondary ? (
              <TouchableOpacity
                style={styles.action}
                onPress={entry.buttonAction}
                accessibilityRole="button"
                accessibilityLabel={secondaryLabel}
                testID={`status-row-action-${entry.id}`}
              >
                <Text style={styles.actionText}>{secondaryLabel}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
        {detailsOpen ? (
          <View style={styles.details}>
            {entry.code ? <CopyRow label={t('errorBanner.codeLabel')} value={entry.code} /> : null}
            {entry.rawMessage ? <CopyRow label={t('errorBanner.rawLabel')} value={entry.rawMessage} /> : null}
          </View>
        ) : null}
      </Animated.View>
    </GestureDetector>
  )
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const theme = useTheme()
  const styles = useMemo(() => makeStyles(theme, theme.border), [theme])
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [value])

  return (
    <View style={styles.copyRow}>
      <View style={styles.copyRowText}>
        <Text style={styles.copyLabel}>{label}</Text>
        <Text style={styles.copyValue} selectable>{value}</Text>
      </View>
      <TouchableOpacity
        onPress={handleCopy}
        style={styles.copyBtn}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {copied
          ? <Check size={16} color={theme.text.success} />
          : <Copy size={16} color={theme.text.secondary} />}
      </TouchableOpacity>
    </View>
  )
}

function makeStyles(theme: Theme, accent: string) {
  return StyleSheet.create({
    row: {
      borderWidth: 1,
      borderColor: accent === theme.status.failed ? `${theme.status.failed}66` : theme.border,
      borderRadius: radius.md,
      backgroundColor: theme.bg.primary,
      padding: spacing.md,
      gap: spacing.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    dismiss: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      flex: 1,
      color: theme.text.primary,
      fontSize: font.base,
      fontWeight: '600',
    },
    message: {
      color: theme.text.secondary,
      fontSize: font.sm,
      lineHeight: 18,
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    action: {
      minHeight: TARGET,
      paddingHorizontal: spacing.md,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    retry: {
      backgroundColor: theme.status.failed,
      borderColor: theme.status.failed,
    },
    actionText: {
      color: theme.text.secondary,
      fontSize: font.sm,
      fontWeight: '600',
    },
    retryText: {
      color: theme.text.onAccent,
    },
    details: {
      gap: spacing.sm,
    },
    copyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      backgroundColor: theme.bg.secondary,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      minHeight: TARGET,
    },
    copyRowText: {
      flex: 1,
      paddingVertical: spacing.sm,
    },
    copyLabel: {
      color: theme.text.secondary,
      fontSize: 11,
      textTransform: 'uppercase',
    },
    copyValue: {
      color: theme.text.primary,
      fontSize: 12,
      fontFamily: 'monospace',
      marginTop: 2,
    },
    copyBtn: {
      width: TARGET,
      height: TARGET,
      alignItems: 'center',
      justifyContent: 'center',
    },
  })
}
