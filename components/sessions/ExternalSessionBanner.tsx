import React from 'react'
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Terminal } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { type Theme, font, spacing } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'

interface Props {
  /** Confirmed take-over. The caller owns the mutation and the navigation. */
  onTakeOver: () => void
  isTakingOver?: boolean
}

/**
 * Shown on a session the streamer discovered but does not own.
 *
 * Such a session streams its transcript and nothing else: its prompts are drawn
 * by the CLI's own TUI, which only the process holding the PTY can see, so a
 * question card can never appear for one. Saying that is the point — without it
 * the screen just shows raw output and looks broken rather than limited.
 *
 * Taking over is the only way out, and it is destructive: the server SIGTERMs
 * the process running in the user's terminal and respawns it as one it owns.
 * Hence the confirmation, and hence copy that names the terminal rather than
 * saying something vague like "restart".
 *
 * The mutation is the caller's so this stays renderable without a query client.
 */
export function ExternalSessionBanner({ onTakeOver, isTakingOver = false }: Props) {
  const { t } = useTranslation(['terminal', 'common'])
  const theme = useTheme()
  const styles = makeStyles(theme)

  const confirmTakeOver = () => {
    Alert.alert(t('session.takeOverConfirmTitle'), t('session.takeOverConfirmBody'), [
      { text: t('common:button.cancel'), style: 'cancel' },
      { text: t('session.takeOver'), style: 'destructive', onPress: onTakeOver },
    ])
  }

  return (
    <View style={styles.banner} accessibilityRole="alert" testID="external-session-banner">
      <Terminal size={16} color={theme.text.warning} />
      <View style={styles.textBlock}>
        <Text style={[styles.title, { color: theme.text.warning }]}>
          {t('session.externalTitle')}
        </Text>
        <Text style={styles.subtitle}>{t('session.externalMessage')}</Text>
      </View>
      <TouchableOpacity
        onPress={confirmTakeOver}
        disabled={isTakingOver}
        accessibilityRole="button"
        accessibilityLabel={t('session.takeOver')}
        testID="external-session-take-over"
        style={[styles.action, isTakingOver && styles.actionDisabled]}
      >
        {isTakingOver ? (
          <ActivityIndicator size="small" color={theme.text.warning} />
        ) : (
          <Text style={[styles.actionText, { color: theme.text.warning }]}>
            {t('session.takeOver')}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      backgroundColor: theme.bg.secondary,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    textBlock: {
      flex: 1,
      gap: 1,
    },
    title: {
      fontSize: font.sm,
      fontWeight: '600',
    },
    subtitle: {
      color: theme.text.secondary,
      fontSize: font.xs,
      lineHeight: 15,
    },
    action: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.text.warning,
    },
    actionDisabled: {
      opacity: 0.5,
    },
    actionText: {
      fontSize: font.xs,
      fontWeight: '600',
    },
  })
}
