import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { KnightRiderScanner } from '@/components/sessions/KnightRiderScanner'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { useReducedMotion } from '@/hooks/useReducedMotion'

interface Props {
  visible: boolean
}

/**
 * A pill pinned under the status bar while a query silently retries. It never
 * intercepts a touch: the screen underneath stays fully usable.
 */
export function RecoveryOverlay({ visible }: Props) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const insets = useSafeAreaInsets()
  const reduceMotion = useReducedMotion()
  const { t } = useTranslation('common')

  if (!visible) return null

  return (
    <View
      pointerEvents="none"
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
      gap: spacing.xs,
      paddingEnd: spacing.md,
      backgroundColor: theme.bg.card,
      borderRadius: radius.full,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    title: {
      color: theme.text.secondary,
      fontSize: font.xs,
      fontWeight: '600',
    },
  })
}
