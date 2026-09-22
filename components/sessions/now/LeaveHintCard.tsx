import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Info } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { blockTextDirectionStyle, useAppDirection } from '@/lib/rtl'

interface Props {
  onDismiss: () => void
  onOpenSettings: () => void
}

/** One-time note that leaving no longer ends a session, shown above the live cards. */
export function LeaveHintCard({ onDismiss, onOpenSettings }: Props) {
  const { t } = useTranslation('sessions')
  const theme = useTheme()
  const styles = makeStyles(theme)
  const { direction } = useAppDirection()
  const copyStyle = blockTextDirectionStyle(direction)

  return (
    <View style={styles.card} testID="leave-hint-card">
      <Info size={18} color={theme.text.accent} />
      <View style={styles.copy}>
        <Text style={[styles.body, copyStyle]}>{t('leaveHint.body')}</Text>
        <View style={styles.actions}>
          <Pressable onPress={onDismiss} hitSlop={8} accessibilityRole="button" testID="leave-hint-dismiss">
            <Text style={styles.primary}>{t('leaveHint.gotIt')}</Text>
          </Pressable>
          <Pressable onPress={onOpenSettings} hitSlop={8} accessibilityRole="button" testID="leave-hint-settings">
            <Text style={styles.secondary}>{t('leaveHint.settings')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderRadius: radius.lg - 4,
      borderWidth: 1,
      borderColor: `${theme.text.accent}40`,
      backgroundColor: theme.bg.secondary,
    },
    copy: { flex: 1, gap: spacing.sm },
    body: { color: theme.text.primary, fontSize: font.sm, lineHeight: 19 },
    actions: { flexDirection: 'row', gap: spacing.lg },
    primary: { color: theme.text.accent, fontSize: font.sm, fontWeight: '600' },
    secondary: { color: theme.text.secondary, fontSize: font.sm },
  })
}
