import React, { useMemo } from 'react'
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { GlassFill } from '@/components/ui/GlassFill'
import { alertAppearance } from '@/lib/alertAppearance'
import type { AlertLevel } from '@/types/alerts'

type Props = {
  title: string
  message: string
  details?: string
  level: AlertLevel
  accent?: string
  onClose: () => void
}

export function AlertDetailsModal({ title, message, details, level, accent, onClose }: Props) {
  const { t } = useTranslation(['shared', 'common'])
  const theme = useTheme()
  const styles = useMemo(() => makeStyles(theme), [theme])
  const appearance = alertAppearance(level, theme, accent)
  const Icon = appearance.Icon
  const closeLabel = t('common:button.close')

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <GlassFill />
          <View style={styles.header}>
            <Icon size={20} color={appearance.accent} weight={appearance.iconWeight} />
            <Text style={styles.title}>{title}</Text>
          </View>
          <Text style={[styles.message, { color: appearance.accent }]}>{message}</Text>
          {details ? <Text style={styles.details}>{details}</Text> : null}
          <TouchableOpacity
            style={styles.dismissBtn}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
          >
            <Text style={styles.dismissText}>{closeLabel}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
    },
    sheet: {
      backgroundColor: theme.bg.secondary,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: spacing.md,
      gap: spacing.sm,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    title: {
      flex: 1,
      color: theme.text.primary,
      fontSize: font.base,
      fontWeight: '600',
      lineHeight: 20,
    },
    message: {
      fontSize: font.sm,
      lineHeight: 18,
    },
    details: {
      color: theme.text.secondary,
      fontSize: font.sm,
      lineHeight: 18,
    },
    dismissBtn: {
      alignSelf: 'flex-end',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    dismissText: {
      color: theme.text.accent,
      fontSize: font.sm,
      fontWeight: '600',
    },
  })
}
