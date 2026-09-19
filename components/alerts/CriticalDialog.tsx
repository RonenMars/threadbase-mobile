import React, { useMemo } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { useReduceMotion } from '@/hooks/useAccessibilitySettings'
import { alertAppearance } from '@/lib/alertAppearance'
import { getAlertLevelLabel } from '@/lib/alertLabels'
import { blockTextDirectionStyle, textDirectionStyle, useAppDirection, useDirectionStyle } from '@/lib/rtl'
import type { AlertButtonVariant, AlertLevel } from '@/types/alerts'

const TARGET = 44

export type CriticalAction = {
  label: string
  onPress: () => void
  variant?: AlertButtonVariant
  testID?: string
}

type Props = {
  visible: boolean
  title: string
  message?: string
  children?: React.ReactNode
  actions?: readonly CriticalAction[]
  onRequestClose: () => void
  onDismiss?: () => void
  testID?: string
  dismissable?: boolean
  busy?: boolean
  level?: AlertLevel
}

export function CriticalDialog({
  visible,
  title,
  message,
  children,
  actions = [],
  onRequestClose,
  onDismiss,
  testID = 'critical-dialog',
  dismissable = true,
  busy = false,
  level = 'critical',
}: Props) {
  const { t } = useTranslation('common')
  const theme = useTheme()
  const styles = useMemo(() => makeStyles(theme), [theme])
  const reduceMotion = useReduceMotion()
  const directionStyle = useDirectionStyle()
  const { direction } = useAppDirection()
  const copyStyle = blockTextDirectionStyle(direction)
  const labelStyle = textDirectionStyle(direction)
  const appearance = alertAppearance(level, theme)
  const Icon = appearance.Icon
  const accessibilityLabel = `${getAlertLevelLabel(level, t)}. ${title}`

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      statusBarTranslucent
      onRequestClose={dismissable ? onRequestClose : () => {}}
      onDismiss={onDismiss}
    >
      <View style={[styles.overlay, directionStyle]}>
        {dismissable ? (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onRequestClose}
            accessibilityLabel={t('button.cancel')}
          />
        ) : null}
        <View
          style={styles.card}
          accessibilityRole="alert"
          accessibilityViewIsModal
          accessibilityLabel={accessibilityLabel}
          accessibilityLiveRegion="assertive"
          testID={testID}
        >
          <View style={styles.header}>
            <Icon size={20} color={appearance.accent} weight={appearance.iconWeight} />
            <Text style={[styles.title, copyStyle]}>{title}</Text>
          </View>
          {busy ? (
            <View style={styles.busyRow}>
              <ActivityIndicator color={theme.text.accent} />
              {message ? <Text style={[styles.message, copyStyle]}>{message}</Text> : null}
            </View>
          ) : (
            <>
              {message ? <Text style={[styles.message, copyStyle]}>{message}</Text> : null}
              {children}
            </>
          )}
          {!busy && actions.length > 0 ? (
            <View style={styles.actions}>
              {actions.map((action) => {
                const variant = action.variant ?? 'primary'
                return (
                  <TouchableOpacity
                    key={action.testID ?? action.label}
                    style={[styles.action, actionStyle(styles, variant)]}
                    onPress={action.onPress}
                    accessibilityRole="button"
                    accessibilityLabel={action.label}
                    testID={action.testID}
                  >
                    <Text style={[styles.actionLabel, actionLabelStyle(styles, variant), labelStyle]}>
                      {action.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  )
}

type DialogStyles = ReturnType<typeof makeStyles>

function actionStyle(styles: DialogStyles, variant: AlertButtonVariant) {
  switch (variant) {
    case 'primary':
      return styles.primary
    case 'secondary':
      return styles.secondary
    case 'destructive':
      return styles.destructive
  }
}

function actionLabelStyle(styles: DialogStyles, variant: AlertButtonVariant) {
  switch (variant) {
    case 'primary':
      return styles.primaryLabel
    case 'secondary':
      return styles.secondaryLabel
    case 'destructive':
      return styles.destructiveLabel
  }
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
    },
    card: {
      width: '100%',
      backgroundColor: theme.bg.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: spacing.xl,
      gap: spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    title: {
      flex: 1,
      color: theme.text.primary,
      fontSize: font.lg,
      fontWeight: '600',
    },
    message: {
      color: theme.text.secondary,
      fontSize: font.sm,
      lineHeight: 20,
    },
    busyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    action: {
      flexGrow: 1,
      minHeight: TARGET,
      minWidth: 120,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
    },
    primary: {
      backgroundColor: theme.text.accent,
    },
    secondary: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: 'transparent',
    },
    destructive: {
      backgroundColor: theme.status.failed,
    },
    actionLabel: {
      fontSize: font.base,
      fontWeight: '700',
    },
    primaryLabel: {
      color: theme.text.onAccent,
    },
    secondaryLabel: {
      color: theme.text.primary,
    },
    destructiveLabel: {
      color: theme.text.onAccent,
    },
  })
}
