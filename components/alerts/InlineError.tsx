import React, { useMemo } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { alertAppearance } from '@/lib/alertAppearance'
import { getAlertLevelLabel } from '@/lib/alertLabels'

const TARGET = 44

type Props = {
  title: string
  message: string
  onRetry?: () => void
  retryLabel?: string
  onDetails?: () => void
  detailsLabel?: string
  testID?: string
}

export function InlineError({ title, message, onRetry, retryLabel, onDetails, detailsLabel, testID }: Props) {
  const { t } = useTranslation('common')
  const theme = useTheme()
  const appearance = alertAppearance('error', theme)
  const styles = useMemo(() => makeStyles(theme), [theme])
  const Icon = appearance.Icon
  const retry = retryLabel ?? t('button.retry')
  const accessibilityLabel = `${getAlertLevelLabel('error', t)}. ${title}`

  return (
    <View
      style={styles.box}
      testID={testID}
      accessibilityRole="alert"
      accessibilityLabel={accessibilityLabel}
      accessibilityLiveRegion="assertive"
    >
      <View style={styles.header}>
        <Icon size={16} color={appearance.accent} weight={appearance.iconWeight} />
        <Text style={styles.title}>{title}</Text>
      </View>
      <Text style={styles.message}>{message}</Text>
      {onRetry || onDetails ? (
        <View style={styles.actions}>
          {onRetry ? (
            <TouchableOpacity
              style={styles.retry}
              onPress={onRetry}
              accessibilityRole="button"
              accessibilityLabel={retry}
              testID={testID ? `${testID}-retry` : undefined}
            >
              <Text style={styles.retryText}>{retry}</Text>
            </TouchableOpacity>
          ) : null}
          {onDetails ? (
            <TouchableOpacity
              style={styles.details}
              onPress={onDetails}
              accessibilityRole="button"
              accessibilityLabel={detailsLabel}
              testID={testID ? `${testID}-details` : undefined}
            >
              <Text style={styles.detailsText}>{detailsLabel}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    box: {
      marginHorizontal: spacing.md,
      marginVertical: spacing.sm,
      padding: spacing.md,
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: `${theme.status.failed}73`,
      borderStyle: 'dashed',
      borderRadius: radius.md,
      backgroundColor: theme.bg.card,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
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
    retry: {
      minHeight: TARGET,
      paddingHorizontal: spacing.md,
      borderRadius: radius.sm,
      backgroundColor: theme.status.failed,
      alignItems: 'center',
      justifyContent: 'center',
    },
    retryText: {
      color: theme.text.onAccent,
      fontSize: font.sm,
      fontWeight: '600',
    },
    details: {
      minHeight: TARGET,
      paddingHorizontal: spacing.md,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    detailsText: {
      color: theme.text.secondary,
      fontSize: font.sm,
      fontWeight: '600',
    },
  })
}
