import React, { useMemo } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { X } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { font, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { alertAppearance } from '@/lib/alertAppearance'
import type { ToastEntry } from '@/stores/toasts'

type Props = {
  toast: ToastEntry
  onOpenDetails: () => void
  onDismiss: () => void
}

export function Toast({ toast, onOpenDetails, onDismiss }: Props) {
  const { t } = useTranslation('common')
  const theme = useTheme()
  const styles = useMemo(() => makeStyles(theme), [theme])
  const appearance = alertAppearance(toast.level, theme, toast.accent)
  const Icon = appearance.Icon
  const closeLabel = t('button.close')
  const hasDetails = Boolean(toast.details || toast.message)
  const showClose = toast.hideCloseButton !== true

  function handleBodyPress() {
    if (hasDetails) {
      onOpenDetails()
      return
    }
    toast.onPress?.()
  }

  const titleColor = toast.level === 'info' || toast.level === 'debug'
    ? theme.text.secondary
    : theme.text.primary
  const bodyRole = hasDetails || toast.onPress ? 'button' as const : undefined

  return (
    <View style={styles.banner}>
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
        <Text
          style={[styles.title, { color: titleColor }]}
          numberOfLines={2}
        >
          {toast.title}
        </Text>
      </TouchableOpacity>
      {toast.buttonText ? (
        <TouchableOpacity
          style={[styles.actionBtn, actionBorder(theme, appearance.accent, toast.buttonVariant)]}
          onPress={toast.buttonAction}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          accessibilityRole="button"
          accessibilityLabel={toast.buttonText}
        >
          <Text style={[styles.actionText, actionText(theme, appearance.accent, toast.buttonVariant)]}>
            {toast.buttonText}
          </Text>
        </TouchableOpacity>
      ) : null}
      {showClose ? (
        <TouchableOpacity
          onPress={() => {
            toast.onClose?.()
            onDismiss()
          }}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          testID={`toast-close-${toast.id}`}
        >
          <X size={14} color={theme.text.secondary} />
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

function actionBorder(theme: Theme, accent: string, variant: ToastEntry['buttonVariant']) {
  if (variant === 'destructive') return { borderColor: theme.text.danger }
  if (variant === 'primary') return { borderColor: accent }
  return { borderColor: accent }
}

function actionText(theme: Theme, accent: string, variant: ToastEntry['buttonVariant']) {
  if (variant === 'destructive') return { color: theme.text.danger }
  return { color: accent }
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
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
      fontSize: font.sm,
      fontWeight: '500',
      lineHeight: 18,
    },
    actionBtn: {
      borderWidth: 1,
      borderRadius: 6,
      paddingVertical: 3,
      paddingHorizontal: spacing.sm,
    },
    actionText: {
      fontSize: font.xs,
      fontWeight: '600',
    },
  })
}
