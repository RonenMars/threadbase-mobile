import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { X } from 'phosphor-react-native'
import { KnightRiderScanner } from '@/components/sessions/KnightRiderScanner'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { useReducedMotion } from '@/hooks/useReducedMotion'

interface Props {
  visible: boolean
  /** What is retrying, e.g. `Win · GET /sessions`. */
  detail?: string
  /** Shows a close button that calls this. */
  onDismiss?: () => void
}

/**
 * A pill pinned under the status bar while a query silently retries. Only the
 * close button takes touches: the rest of the screen stays fully usable.
 */
export function RecoveryOverlay({ visible, detail, onDismiss }: Props) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const insets = useSafeAreaInsets()
  const reduceMotion = useReducedMotion()
  const { t } = useTranslation('common')

  if (!visible) return null

  return (
    <View
      pointerEvents="box-none"
      style={[styles.lane, { top: insets.top + spacing.xs }]}
      testID="recovery-overlay"
    >
      <Animated.View
        entering={reduceMotion ? undefined : FadeIn.duration(180)}
        exiting={reduceMotion ? undefined : FadeOut.duration(120)}
        style={styles.pill}
        accessibilityRole="progressbar"
        accessibilityLabel={t('recovery.title')}
        accessibilityLiveRegion="polite"
      >
        <KnightRiderScanner testID="recovery-scanner" accessibilityLabel={t('recovery.title')} />
        <Text style={styles.title} numberOfLines={1}>
          {t('recovery.title')}
        </Text>
        {detail ? (
          <Text style={styles.detail} numberOfLines={1} testID="recovery-detail">
            {detail}
          </Text>
        ) : null}
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
      </Animated.View>
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    lane: {
      position: 'absolute',
      left: 0,
      right: 0,
      alignItems: 'center',
      zIndex: 50,
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: 48,
      paddingStart: spacing.xs,
      paddingEnd: spacing.xs,
      maxWidth: '92%',
      backgroundColor: theme.bg.card,
      borderRadius: radius.full,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    title: {
      color: theme.text.secondary,
      fontSize: font.sm,
      fontWeight: '600',
    },
    close: {
      width: 44,
      height: 44,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    detail: {
      color: theme.text.secondary,
      opacity: 0.75,
      fontSize: font.sm,
      flexShrink: 1,
    },
  })
}
